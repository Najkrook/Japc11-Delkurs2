import test from 'node:test';
import assert from 'node:assert/strict';
import { courseWeeks } from '../src/course/data/index.ts';
import { SUSHI_CATALOG } from '../src/course/sushi-game/catalog.ts';
import { createDefaultRestaurantState } from '../src/course/sushi-game/economy.ts';
import {
  getChapterHonors,
  getGuestStudyDeck,
  getSushiGoals,
} from '../src/course/sushi-game/study-companion.ts';

const allGrants = SUSHI_CATALOG.map((item) => item.id);

test('a fractional shortfall never claims an unaffordable goal is missing zero yen', () => {
  const state = createDefaultRestaurantState('fractional-goal', 0, {
    permanentGrants: ['prep_counter'],
    balanceUnits: 50 * 60_000 - 1,
  });
  const goal = getSushiGoals(state).grow;
  assert.equal(goal?.item.id, 'prep_counter');
  assert.equal(goal?.affordable, false);
  assert.match(goal!.reasonSv, /Saknar ¥ 1 /);
});

test('growth and personalization suggestions are separate and follow actual useful effects', () => {
  const state = createDefaultRestaurantState('goal', 0, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    balanceUnits: 4000 * 60_000,
    inventory: ['prep_counter'],
    permanentGrants: ['prep_counter', 'salmon_nigiri', 'conveyor_belt'],
  });
  const goals = getSushiGoals(state);
  assert.equal(goals.grow?.item.id, 'conveyor_belt');
  assert.equal(goals.grow?.incomeDelta, 10);
  assert.equal(goals.grow?.affordable, true);
  assert.match(goals.grow!.reasonSv, /20 → 30/);
  assert.equal(goals.personalize?.item.id, 'salmon_nigiri');
  assert.equal(goals.personalize?.incomeDelta, 0);
  assert.match(goals.personalize!.reasonSv, /intäkten ändras inte/);
});

test('nonsequential unlocked capacity is not promoted above a useful study goal', () => {
  const state = createDefaultRestaurantState('late', 0, {
    balanceUnits: 1_000_000 * 60_000,
    permanentGrants: ['conveyor_belt', 'sous_chef'],
  });
  const goal = getSushiGoals(state).grow;
  // The sous-chef is useful immediately at the base state. The conveyor belt
  // is not: service already exceeds the kitchen. A later eligible chapter is
  // valid without inventing an item prerequisite.
  assert.equal(goal?.item.id, 'sous_chef');
  assert.equal(goal?.unlocked, true);
  assert.equal(goal?.incomeDelta, 10);
  const onlyBelt = getSushiGoals({ ...state, permanentGrants: ['conveyor_belt'] }).grow;
  assert.equal(onlyBelt?.item.id, 'prep_counter');
  assert.equal(onlyBelt?.requiresStudy, true);
  assert.equal(onlyBelt?.item.requiredLesson, 6);
});

test('a zero-wallet goal gives an honest wait and recognizes money in the register', () => {
  const prep = SUSHI_CATALOG.find((item) => item.id === 'prep_counter')!;
  const state = createDefaultRestaurantState('new', 0, {
    permanentGrants: ['prep_counter'],
  });
  const saving = getSushiGoals(state).grow!;
  assert.equal(saving.item.id, 'prep_counter');
  assert.equal(saving.affordable, false);
  assert.equal(saving.waitMinutes, Math.ceil(prep.priceYen / 10));
  assert.match(saving.reasonSv, /disponibelt saldo/);
  const collect = getSushiGoals({ ...state, uncollectedUnits: prep.priceUnits }).grow!;
  assert.equal(collect.collectFirst, true);
  assert.equal(collect.affordable, false);
  assert.equal(collect.waitMinutes, 0);
  assert.match(collect.reasonSv, /Hämta först/);
  const ready = getSushiGoals({ ...state, balanceUnits: prep.priceUnits }).grow!;
  assert.equal(ready.affordable, true);
  assert.match(ready.reasonSv, /råd med köpet nu/);
});

test('an eligible affordable income upgrade is preferred to saving for another', () => {
  const prep = SUSHI_CATALOG.find((item) => item.id === 'prep_counter')!;
  const state = createDefaultRestaurantState('affordable', 0, {
    balanceUnits: prep.priceUnits,
    permanentGrants: allGrants,
  });
  assert.equal(getSushiGoals(state).grow?.item.id, 'prep_counter');
});

test('average-revenue upgrades remain production goals rather than personalization', () => {
  const license = SUSHI_CATALOG.find((item) => item.id === 'master_license')!;
  const state = createDefaultRestaurantState('revenue', 0, {
    kitchenCapacity: 6,
    serviceCapacity: 6,
    averageRevenuePerOrder: 12,
    inventory: SUSHI_CATALOG.filter((item) => item.id !== license.id).map((item) => item.id),
    permanentGrants: allGrants,
    balanceUnits: license.priceUnits,
  });
  const goals = getSushiGoals(state);
  assert.equal(goals.grow?.item.id, license.id);
  assert.equal(goals.grow?.incomeDelta, 6 * license.averageRevenueDelta!);
  assert.equal(goals.personalize, null);
});

test('storage goals explain their real benefit rather than claiming income growth', () => {
  const state = createDefaultRestaurantState('storage', 0, {
    inventory: SUSHI_CATALOG.filter((item) => item.category !== 'cap').map((item) => item.id),
    permanentGrants: allGrants,
    balanceUnits: 1_000_000 * 60_000,
  });
  const goal = getSushiGoals(state).grow!;
  assert.equal(goal.item.id, 'cap_extension_12h');
  assert.equal(goal.incomeDelta, 0);
  assert.ok(goal.extraStorageHours > 0);
  assert.match(goal.reasonSv, /intäktstakten ändras inte/);
});

test('complete inventory ends both goals and unknown legacy IDs do not hide rewards', () => {
  const full = createDefaultRestaurantState('complete', 0, {
    inventory: [...allGrants, 'unknown_legacy_item'],
    permanentGrants: [...allGrants, 'unknown_legacy_grant'],
  });
  assert.deepEqual(getSushiGoals(full), { grow: null, personalize: null });
  const legacy = getSushiGoals({
    ...full,
    inventory: ['unknown_legacy_item'],
    permanentGrants: ['prep_counter', 'unknown_legacy_grant'],
  });
  assert.equal(legacy.grow?.item.id, 'prep_counter');
});

test('gold honors are awarded from permanent grants before buying any decoration', () => {
  const state = createDefaultRestaurantState('honors', 0, {
    permanentGrants: ['golden_maneki_neko', 'paper_lantern', 'unrecognized'],
  });
  const honors = getChapterHonors(state);
  assert.equal(honors.length, 7);
  assert.deepEqual(
    honors.map((honor) => honor.lessonNumber),
    [6, 7, 8, 9, 10, 11, 12],
  );
  assert.deepEqual(
    honors.filter((honor) => honor.earned).map((honor) => honor.lessonNumber),
    [6, 12],
  );
  assert.ok(honors.every((honor) => !honor.decorationOwned));
  assert.equal(honors[6].weekId, 'week-7');
  assert.equal(honors[6].decorationName, 'Gyllene Maneki-Neko');
});

test('all seven gold honors remain visible regardless of equipment or later study scores', () => {
  const state = createDefaultRestaurantState('gold', 0, {
    permanentGrants: allGrants,
    inventory: ['paper_lantern'],
    equipped: { wallSlot: null, floorSlot: null },
  });
  const honors = getChapterHonors(state);
  assert.equal(honors.filter((honor) => honor.earned).length, 7);
  assert.equal(honors.filter((honor) => honor.decorationOwned).length, 1);
  assert.deepEqual(
    getChapterHonors({ ...state, equipped: { wallSlot: 'paper_lantern', floorSlot: null } }),
    honors,
  );
  // There is deliberately no current-score argument: the permanent grant is
  // the evidence of achievement after practice falls or progress is reset.
  assert.deepEqual(
    getChapterHonors({ permanentGrants: allGrants, inventory: [] }).map((h) => h.earned),
    Array(7).fill(true),
  );
});

test('every chapter has a distinct deterministic deck anchored to approved course content', () => {
  const firstPrompts = new Set<string>();
  for (const week of courseWeeks) {
    const cards = getGuestStudyDeck(week.lessonNumber);
    assert.ok(cards.length >= 3, `chapter ${week.lessonNumber} needs at least three recall cards`);
    assert.deepEqual(cards, getGuestStudyDeck(week.lessonNumber));
    assert.equal(new Set(cards.map((card) => card.promptJp)).size, cards.length);
    firstPrompts.add(cards[0].promptJp);
    for (const card of cards) {
      assert.equal(card.lessonNumber, week.lessonNumber);
      assert.equal(card.weekId, week.id);
      assert.ok(card.questionSv.length > 0);
      assert.ok(card.sourceTitleSv.length > 0);
      if (card.sourceKind === 'grammar') {
        const point = week.grammar.find((candidate) => candidate.id === card.sourceId)!;
        assert.ok(point);
        assert.equal(card.sourceTitleSv, point.title);
        assert.ok(
          point.examples.some(
            (example) =>
              example.jp === card.promptJp &&
              example.kana === card.reading &&
              example.sv === card.answerSv,
          ),
        );
      } else {
        const word = week.vocab.find((candidate) => candidate.id === card.sourceId)!;
        assert.ok(word);
        assert.equal(card.promptJp, word.kanji || word.kana);
        assert.equal(card.reading, word.kana);
        assert.equal(card.answerSv, word.sv);
      }
    }
  }
  assert.equal(firstPrompts.size, 7);
});

test('unknown chapters return no fabricated content, and sparse chapters use their vocabulary', () => {
  assert.deepEqual(getGuestStudyDeck(5), []);
  assert.deepEqual(getGuestStudyDeck(13), []);
  const week = { ...courseWeeks[0], grammar: [], vocab: courseWeeks[0].vocab.slice(0, 3) };
  const cards = getGuestStudyDeck(6, [week]);
  assert.equal(cards.length, 3);
  assert.ok(cards.every((card) => card.sourceKind === 'vocabulary'));
});

test('suggestions, honors and guest decks never mutate restaurant state or course data', () => {
  const state = createDefaultRestaurantState('pure', 0, {
    permanentGrants: allGrants,
    balanceUnits: 10_000 * 60_000,
  });
  const beforeState = structuredClone(state);
  const beforeWeeks = structuredClone(courseWeeks);
  getSushiGoals(state);
  getChapterHonors(state);
  for (const week of courseWeeks) getGuestStudyDeck(week.lessonNumber);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(courseWeeks, beforeWeeks);
});
