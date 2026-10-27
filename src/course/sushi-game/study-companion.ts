import { courseWeeks } from '../data/index.ts';
import type { CourseWeek } from '../types.ts';
import { SUSHI_CATALOG, getCatalogItem, previewCatalogPurchase } from './catalog.ts';
import type { SushiCatalogItem } from './catalog.ts';
import { calculateProductionRate } from './economy.ts';
import { MEDAL_GRANT_RULES } from './medals.ts';
import type { SushiRestaurantState } from './types.ts';

/** A suggestion explains its purpose; it never introduces another purchase gate. */
export interface SushiGoal {
  readonly item: SushiCatalogItem;
  readonly unlocked: boolean;
  readonly affordable: boolean;
  readonly requiresStudy: boolean;
  readonly collectFirst: boolean;
  readonly reasonSv: string;
  readonly incomeDelta: number;
  readonly extraStorageHours: number;
  readonly waitMinutes: number;
}

export interface SushiGoals {
  readonly grow: SushiGoal | null;
  readonly personalize: SushiGoal | null;
}

type GoalCandidate = {
  item: SushiCatalogItem;
  unlocked: boolean;
  affordable: boolean;
  incomeDelta: number;
  extraStorageHours: number;
};

/**
 * Production suggestions favor a useful, eligible purchase. An upgrade which
 * only adds unused capacity is never recommended as immediate growth. When no
 * useful purchase is eligible, the suggestion leads to its actual course gate.
 * Personalization is deliberately separate so a cheap visual does not displace
 * the production goal. Neither suggestion changes inventory or course progress.
 */
export function getSushiGoals(state: SushiRestaurantState): SushiGoals {
  const owned = new Set(state.inventory);
  const grants = new Set(state.permanentGrants);
  const rate = calculateProductionRate(
    state.kitchenCapacity,
    state.serviceCapacity,
    state.averageRevenuePerOrder,
  );
  const candidates: GoalCandidate[] = SUSHI_CATALOG.filter((item) => !owned.has(item.id)).map(
    (item) => {
      const impact = previewCatalogPurchase(state, item.id)!;
      return {
        item,
        unlocked: grants.has(item.id),
        affordable: state.balanceUnits >= item.priceUnits,
        incomeDelta: impact.yenDelta,
        extraStorageHours: Math.max(0, impact.newCapMs - state.capMs) / 3_600_000,
      };
    },
  );

  const usefulIncome = candidates.filter((candidate) => candidate.incomeDelta > 0);
  const usefulStorage = candidates.filter((candidate) => candidate.extraStorageHours > 0);
  const productionOrder = (a: GoalCandidate, b: GoalCandidate) =>
    Number(b.affordable) - Number(a.affordable) ||
    a.item.priceYen / Math.max(1, a.incomeDelta) - b.item.priceYen / Math.max(1, b.incomeDelta) ||
    a.item.requiredLesson - b.item.requiredLesson;
  const studyOrder = (a: GoalCandidate, b: GoalCandidate) =>
    a.item.requiredLesson - b.item.requiredLesson ||
    a.item.requiredPercent - b.item.requiredPercent ||
    a.item.priceYen - b.item.priceYen;
  const first = (items: GoalCandidate[], unlocked: boolean, order = productionOrder) =>
    items.filter((candidate) => candidate.unlocked === unlocked).sort(order)[0];

  const grow =
    first(usefulIncome, true) ??
    first(usefulStorage, true) ??
    first(usefulIncome, false, studyOrder) ??
    first(usefulStorage, false, studyOrder);
  const visual = candidates.filter(
    ({ item }) => item.category === 'recipe' || item.category === 'decoration',
  );
  const visualOrder = (a: GoalCandidate, b: GoalCandidate) =>
    Number(b.affordable) - Number(a.affordable) ||
    a.item.priceYen - b.item.priceYen ||
    a.item.requiredLesson - b.item.requiredLesson;
  const personalize = first(visual, true, visualOrder) ?? first(visual, false, studyOrder);

  const describe = (candidate: GoalCandidate | undefined, purpose: 'grow' | 'personalize') => {
    if (!candidate) return null;
    const { item, unlocked, affordable, incomeDelta, extraStorageHours } = candidate;
    const collectFirst =
      unlocked && !affordable && state.balanceUnits + state.uncollectedUnits >= item.priceUnits;
    const shortfallUnits = Math.max(
      0,
      item.priceUnits - state.balanceUnits - state.uncollectedUnits,
    );
    const waitMinutes =
      rate.yenPerMinute > 0 ? Math.ceil(shortfallUnits / 60_000 / rate.yenPerMinute) : 0;
    const benefit =
      purpose === 'personalize'
        ? item.category === 'decoration'
          ? 'Gör restaurangen personlig med en dekoration; intäkten ändras inte.'
          : 'Lägg till en rätt på menyn; intäkten ändras inte.'
        : incomeDelta > 0
          ? `Ger +${incomeDelta} ¥/min direkt (${rate.yenPerMinute} → ${rate.yenPerMinute + incomeDelta}).`
          : `Sparar upp till ${extraStorageHours} timmar mer mellan hämtningar; intäktstakten ändras inte.`;
    const action = !unlocked
      ? `Studera Kapitel ${item.requiredLesson} till ${item.requiredTierLabel.toLocaleLowerCase('sv-SE')} (${item.requiredPercent} %) för att låsa upp köpet.`
      : collectFirst
        ? 'Hämta först intäkterna i kassan så räcker saldot.'
        : affordable
          ? 'Du har råd med köpet nu.'
          : `Saknar ¥ ${Math.ceil(Math.max(0, item.priceUnits - state.balanceUnits) / 60_000)} i disponibelt saldo. Hämta intäkterna när du vill.`;
    return {
      ...candidate,
      requiresStudy: !unlocked,
      collectFirst,
      reasonSv: `${benefit} ${action}`,
      waitMinutes,
    } satisfies SushiGoal;
  };

  return { grow: describe(grow, 'grow'), personalize: describe(personalize, 'personalize') };
}

export interface SushiChapterHonor {
  readonly lessonNumber: number;
  readonly weekId: string;
  readonly titleSv: string;
  readonly grantId: string;
  readonly decorationName: string;
  readonly icon: string;
  readonly earned: boolean;
  readonly decorationOwned: boolean;
}

/**
 * All chapter honors have a permanent home. A gold grant awards the honor
 * immediately; buying or equipping its separate decoration is not required.
 * Current practice scores cannot erase a previously awarded permanent grant.
 */
export function getChapterHonors(
  state: Pick<SushiRestaurantState, 'permanentGrants' | 'inventory'>,
  weeks: readonly CourseWeek[] = courseWeeks,
): SushiChapterHonor[] {
  const grants = new Set(state.permanentGrants);
  const owned = new Set(state.inventory);
  return MEDAL_GRANT_RULES.filter((rule) => rule.requiredTier === 'gold').flatMap((rule) => {
    const week = weeks.find((candidate) => candidate.lessonNumber === rule.lessonNumber);
    const item = getCatalogItem(rule.grantId);
    if (!week || !item) return [];
    return [
      {
        lessonNumber: rule.lessonNumber,
        weekId: week.id,
        titleSv: week.titleSv,
        grantId: rule.grantId,
        decorationName: item.name,
        icon: item.icon,
        earned: grants.has(rule.grantId),
        decorationOwned: owned.has(rule.grantId),
      },
    ];
  });
}

export interface GuestStudyCard {
  readonly id: string;
  readonly lessonNumber: number;
  readonly weekId: string;
  readonly promptJp: string;
  readonly reading: string;
  readonly answerSv: string;
  readonly questionSv: string;
  readonly sourceId: string;
  readonly sourceKind: 'grammar' | 'vocabulary';
  readonly sourceTitleSv: string;
}

/**
 * A deterministic, optional recall deck drawn verbatim from approved course
 * examples and vocabulary. Japanese, readings and translations stay together
 * with their source; no generated dialogue is presented as curriculum content.
 * Revealing or advancing a card has no economic or mastery side effect.
 */
export function getGuestStudyDeck(
  lessonNumber: number,
  weeks: readonly CourseWeek[] = courseWeeks,
): GuestStudyCard[] {
  const week = weeks.find((candidate) => candidate.lessonNumber === lessonNumber);
  if (!week) return [];
  const seen = new Set<string>();
  const cards: GuestStudyCard[] = [];
  const add = (card: GuestStudyCard) => {
    if (!card.promptJp.trim() || !card.reading.trim() || !card.answerSv.trim()) return;
    if (seen.has(card.promptJp)) return;
    seen.add(card.promptJp);
    cards.push(card);
  };
  const examples = Math.max(0, ...week.grammar.map((point) => point.examples.length));
  // Breadth-first ordering exposes different grammar points before returning to
  // another example of the same point.
  for (let index = 0; index < examples; index++) {
    for (const point of week.grammar) {
      const example = point.examples[index];
      if (!example) continue;
      add({
        id: `${point.id}-example-${index}`,
        lessonNumber: week.lessonNumber,
        weekId: week.id,
        promptJp: example.jp,
        reading: example.kana,
        answerSv: example.sv,
        questionSv: 'Vad betyder gästens mening? Tänk efter innan du visar svaret.',
        sourceId: point.id,
        sourceKind: 'grammar',
        sourceTitleSv: point.title,
      });
    }
  }
  // Sparse/custom chapter datasets can still provide a useful deck using their
  // own vocabulary. The normal seven chapter decks already have many examples.
  if (cards.length < 3) {
    for (const item of week.vocab) {
      add({
        id: item.id,
        lessonNumber: week.lessonNumber,
        weekId: week.id,
        promptJp: item.kanji || item.kana,
        reading: item.kana,
        answerSv: item.sv,
        questionSv: 'Vad betyder ordet? Tänk efter innan du visar svaret.',
        sourceId: item.id,
        sourceKind: 'vocabulary',
        sourceTitleSv: `Glosor: ${item.sv}`,
      });
    }
  }
  return cards;
}
