import test from 'node:test';
import assert from 'node:assert/strict';
import { courseWeeks, getCourseWeekById } from '../src/course/data/index.ts';
import {
  createFreshCourseProgress,
  getWeekMedalTier,
  getWeekProgressSummary,
  readCourseProgress,
  recordWeekQuizScore,
  saveCourseProgress,
  setCourseActiveWeek,
  setDojoMastered,
  toggleKanjiMastered,
  toggleVocabMastered,
} from '../src/course/course-state.ts';
import { getDojoExpectedForm, studyDrills } from '../src/course/study-drills.ts';
import { renderTeFormDojo, setDojoPreferences } from '../src/course/components/te-form-dojo.ts';
import {
  buildAllCourseArenaQuestions,
  generateArenaQuestionDeck,
} from '../src/course/multiplayer/arena-questions.ts';
import { generateRoomCode } from '../src/course/multiplayer/arena-service.ts';
import {
  APPLE_SPRING_DEFAULT,
  APPLE_SPRING_MOMENTUM,
  project,
  rubberband,
} from '../src/course/apple-physics.ts';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => map.set(k, String(v)),
  };
}

test('JAPC11 Delkurs 2 Data: Contains 4 structured Genki weeks (Lessons 6–9) with authentic content', () => {
  assert.equal(courseWeeks.length, 4);

  const w1 = getCourseWeekById('week-1');
  assert.equal(w1.lessonNumber, 6);
  assert.equal(w1.kanji.length, 15, 'Genki Lesson 6 has 15 kanji');
  assert.ok(w1.vocab.length >= 25, 'Lesson 6 has rich vocabulary');
  assert.ok(w1.conjugations.length >= 12, 'Lesson 6 covers all te-form rules');
  assert.ok(w1.quiz.length >= 10, 'Lesson 6 has a complete weekly quiz');

  const iku = w1.conjugations.find((c) => c.dictionaryKanji === '行く');
  assert.ok(iku, '行く conjugation exists');
  assert.equal(iku.teFormKana, 'いって');
  assert.equal(iku.ruleId, 'iku-exception');

  const w2 = getCourseWeekById('week-2');
  assert.equal(w2.lessonNumber, 7);
  assert.equal(w2.kanji.length, 14, 'Genki Lesson 7 has 14 kanji');
  assert.ok(w2.vocab.length >= 18, 'Lesson 7 has family/clothing/appearance vocab');
  assert.ok(w2.quiz.length >= 10, 'Lesson 7 has a complete weekly quiz');

  const w3 = getCourseWeekById('week-3');
  assert.equal(w3.lessonNumber, 8);
  assert.ok(w3.vocab.length >= 20, 'Lesson 8 has complete vocabulary');
  assert.ok(w3.kanji.length >= 12, 'Lesson 8 has complete kanji list');
  assert.ok(w3.conjugations.length >= 10, 'Lesson 8 has complete conjugations');
  assert.ok(w3.quiz.length >= 10, 'Lesson 8 has complete weekly quiz');
  // Check preserved IDs
  assert.ok(w3.vocab.some((v) => v.id === 'w3-v01' && v.kanji === '思う'));
  assert.ok(w3.kanji.some((k) => k.id === 'w3-k01' && k.kanji === '員'));
  assert.ok(w3.conjugations.some((c) => c.id === 'w3-c01' && c.dictionaryKana === 'おもう'));
  assert.ok(w3.quiz.some((q) => q.id === 'w3-q01'));

  const w4 = getCourseWeekById('week-4');
  assert.equal(w4.lessonNumber, 9);
  assert.ok(w4.vocab.length >= 20, 'Lesson 9 has complete vocabulary');
  assert.equal(w4.kanji.length, 15, 'Genki Lesson 9 has 15 authentic kanji');
  assert.ok(w4.conjugations.length >= 10, 'Lesson 9 has complete conjugations');
  assert.ok(w4.quiz.length >= 10, 'Lesson 9 has complete weekly quiz');
  // Check preserved IDs
  assert.ok(w4.vocab.some((v) => v.id === 'w4-v01' && v.kanji === '覚える'));
  assert.ok(w4.kanji.some((k) => k.id === 'w4-k01' && k.kanji === '午'));
  assert.ok(w4.conjugations.some((c) => c.id === 'w4-c01' && c.dictionaryKana === 'おどる'));
  assert.ok(w4.quiz.some((q) => q.id === 'w4-q01'));
});

test('JAPC11 Delkurs 2 State: Tracks mastery across all 4 blocks per week', () => {
  const storage = createMemoryStorage();
  const progress = createFreshCourseProgress();
  const w1 = getCourseWeekById('week-1');

  let summary = getWeekProgressSummary(progress, w1);
  assert.equal(summary.overallPercent, 0);

  toggleVocabMastered(progress, w1.vocab[0].id, true);
  toggleKanjiMastered(progress, w1.kanji[0].id, true);
  setDojoMastered(progress, w1.conjugations[0].id, true);
  recordWeekQuizScore(progress, w1.id, 10, w1.quiz.length);

  saveCourseProgress(storage, 'user-123', progress);
  const loaded = readCourseProgress(storage, 'user-123');

  summary = getWeekProgressSummary(loaded, w1);
  assert.equal(summary.vocabDone, 1);
  assert.equal(summary.kanjiDone, 1);
  assert.equal(summary.dojoDone, 1);
  assert.equal(summary.quizScore, 10);
  assert.ok(summary.overallPercent > 0);

  setCourseActiveWeek(loaded, 'week-2');
  assert.equal(loaded.activeWeekId, 'week-2');
});

test('Course Arena Multiplayer: Generates L6-L9 decks and room codes', () => {
  const allBank = buildAllCourseArenaQuestions('all');
  assert.ok(allBank.length >= 120, 'Generates 120+ Arena questions from Lessons 6–9');

  for (const q of allBank) {
    assert.ok(q.choices.length >= 4, `Question ${q.id} has 4 choices`);
    assert.ok(q.choices.includes(q.answer), `Question ${q.id} includes correct answer`);
    assert.ok(q.lessonNumber >= 6, 'Strictly Lesson 6+ content');
  }

  const teDeck = generateArenaQuestionDeck({
    weekFilter: 'week-1',
    focusMode: 'te-form',
    roundCount: 10,
  });
  assert.equal(teDeck.length, 10);
  assert.ok(teDeck.every((q) => q.weekId === 'week-1' && q.category === 'te-form'));

  const code = generateRoomCode();
  assert.match(code, /^\d{4}$/);
});

test('Arena preserves a small focus pool without adding other categories', () => {
  const config = { weekFilter: 'week-1', focusMode: 'grammar', roundCount: 15 } as const;
  const available = buildAllCourseArenaQuestions(config.weekFilter, () => 0.5).filter(
    (q) => q.category === config.focusMode,
  );
  assert.ok(available.length > 0 && available.length < config.roundCount);
  const deck = generateArenaQuestionDeck(config, () => 0.5);
  assert.deepEqual(new Set(deck.map((q) => q.id)), new Set(available.map((q) => q.id)));
  assert.equal(deck.length, available.length);
});

test('Apple Fluid Interface Physics: rubberband and momentum projection follow WWDC 2018 equations', () => {
  assert.equal(rubberband(0, 300), 0);
  const pos = rubberband(100, 300, 0.55);
  const neg = rubberband(-100, 300, 0.55);
  assert.ok(pos > 0 && pos < 100, 'Rubberband resists positive overshoot');
  assert.equal(neg, -pos, 'Rubberband is symmetric for negative overshoot');
  assert.ok(rubberband(200, 300, 0.55) < 300, 'Rubberband asymptotically approaches dimension');

  const projPos = project(1200, 0.998);
  const projNeg = project(-1200, 0.998);
  assert.ok(projPos > 500, 'Momentum projection projects distance from velocity');
  assert.equal(projNeg, -projPos);

  assert.equal(APPLE_SPRING_DEFAULT.damping, 1.0);
  assert.equal(APPLE_SPRING_MOMENTUM.damping, 0.8);
});

test('Japanese Sensei Stamp Medals: Calculates unrounded medal tiers and enforces exact bounds', () => {
  // Empty weeks
  assert.equal(getWeekMedalTier(0, 0), null);
  assert.equal(getWeekMedalTier(5, 0), null);

  // 0% - 59.9%
  assert.equal(getWeekMedalTier(0, 10), null);
  assert.equal(getWeekMedalTier(50, 100), null);
  assert.equal(
    getWeekMedalTier(599, 1000),
    null,
    '59.9% must NOT award Bronze even if Math.round would yield 60%',
  );

  // Exact 60.0% - 79.9% -> Bronze
  assert.equal(getWeekMedalTier(60, 100), 'bronze');
  assert.equal(getWeekMedalTier(6, 10), 'bronze');
  assert.equal(
    getWeekMedalTier(799, 1000),
    'bronze',
    '79.9% must remain Bronze and NOT award Silver prematurely',
  );

  // Exact 80.0% - 99.9% -> Silver
  assert.equal(getWeekMedalTier(80, 100), 'silver');
  assert.equal(getWeekMedalTier(8, 10), 'silver');
  assert.equal(
    getWeekMedalTier(999, 1000),
    'silver',
    '99.9% must remain Silver and strictly NOT award Gold',
  );

  // Exact 100% -> Gold
  assert.equal(getWeekMedalTier(100, 100), 'gold');
  assert.equal(getWeekMedalTier(10, 10), 'gold');
  assert.equal(getWeekMedalTier(71, 71), 'gold');
});

test('Week Progress Summary: Discards outdated quiz totals when question counts expand', () => {
  const w3 = getCourseWeekById('week-3');
  const progress = createFreshCourseProgress();

  // Simulate an older saved quiz attempt that had 6 questions (6/6)
  progress.quizBestResults['week-3'] = {
    score: 6,
    total: 6,
    completedAt: 1000,
  };

  // Week 3 now has 12 questions. The old 6/6 result must be ignored until retaken.
  const summary = getWeekProgressSummary(progress, w3);
  assert.equal(
    summary.quizScore,
    null,
    'Stale quiz with total !== week.quiz.length is reset to null',
  );
  assert.equal(summary.quizTotal, w3.quiz.length);

  // Complete a valid quiz with current total (12/12)
  recordWeekQuizScore(progress, 'week-3', 12, w3.quiz.length, 2000);
  const updatedSummary = getWeekProgressSummary(progress, w3);
  assert.equal(updatedSummary.quizScore, 12);
});

test('Dojo Target Forms: Adapts expected conjugation forms across weeks (te, nai, ta)', () => {
  const w1 = getCourseWeekById('week-1');
  const w3 = getCourseWeekById('week-3');
  const w4 = getCourseWeekById('week-4');

  const v1 = w1.conjugations[0]; // Taberu
  const exp1 = getDojoExpectedForm(v1);
  assert.equal(exp1.kana, v1.teFormKana, 'Week 1 targets te-form');

  const v3 = w3.conjugations[0]; // Omou
  const exp3 = getDojoExpectedForm(v3);
  assert.equal(exp3.kana, 'おもわない', 'Week 3 targets nai-form');

  const v4 = w4.conjugations[0]; // Odoru
  const exp4 = getDojoExpectedForm(v4);
  assert.equal(exp4.kana, 'おどった', 'Week 4 targets ta-form');
});

function renderTemplateToString(t: unknown): string {
  if (t === null || t === undefined || typeof t === 'boolean') return '';
  if (typeof t === 'string' || typeof t === 'number') return String(t);
  if (Array.isArray(t)) return t.map(renderTemplateToString).join('');
  if (
    typeof t === 'object' &&
    t &&
    'strings' in t &&
    Array.isArray((t as { strings: unknown }).strings)
  ) {
    const tmpl = t as { strings: string[]; values: unknown[] };
    let out = '';
    for (let i = 0; i < tmpl.strings.length; i++) {
      out += tmpl.strings[i];
      if (i < tmpl.values.length) {
        out += renderTemplateToString(tmpl.values[i]);
      }
    }
    return out;
  }
  return '';
}

test('Dojo Facit Protection & Cheatsheet: No answer leaks in placeholder or card metadata before reveal, correct hiragana in cheatsheet', () => {
  const host = { render: () => {}, speak: () => {}, tts: false };

  // 1. Cheatsheet has ぐ → いで and nowhere has Latin いde
  const w1 = getCourseWeekById('week-1');
  const p1 = createFreshCourseProgress();
  setDojoPreferences({ showRuleSheet: true });
  const html1 = renderTemplateToString(
    renderTeFormDojo(
      w1,
      p1,
      host,
      () => {},
      () => {},
    ),
  );
  assert.ok(html1.includes('ぐ → いで'), 'Cheatsheet must contain ぐ → いで in hiragana');
  assert.ok(!html1.includes('いde'), 'Cheatsheet must not contain typo いde');

  // 2. In write mode, placeholder is neutral and never contains expected answer
  setDojoPreferences({ inputMode: 'write' });
  for (const weekId of ['week-1', 'week-2', 'week-3', 'week-4']) {
    const w = getCourseWeekById(weekId);
    const p = createFreshCourseProgress();
    studyDrills.reset();
    const cur = studyDrills.dojo.read(w, courseWeeks, p).current;
    const exp = getDojoExpectedForm(cur);
    const html = renderTemplateToString(
      renderTeFormDojo(
        w,
        p,
        host,
        () => {},
        () => {},
      ),
    );

    assert.ok(
      !html.includes(exp.kana),
      `${weekId} write mode before reveal must not contain expected answer (${exp.kana}) anywhere in DOM`,
    );
    assert.ok(html.includes('placeholder="Skriv '), `${weekId} has neutral input placeholder`);
  }

  // 3. Week 3 (nai-form): card metadata (.dojo-verb-sub) hides target form before reveal, shows after
  const w3 = getCourseWeekById('week-3');
  const p3 = createFreshCourseProgress();
  studyDrills.reset();
  const cur3 = studyDrills.dojo.read(w3, courseWeeks, p3).current;
  const exp3 = getDojoExpectedForm(cur3);
  setDojoPreferences({ inputMode: 'choices' });

  const html3Before = renderTemplateToString(
    renderTeFormDojo(
      w3,
      p3,
      host,
      () => {},
      () => {},
    ),
  );
  const sub3Before = html3Before.split('class="dojo-verb-sub"')[1]?.split('</div>')[0] ?? '';
  assert.ok(
    !sub3Before.includes(exp3.kana),
    'Week 3 verb card metadata must not display nai-form before reveal',
  );

  studyDrills.dojo.submit(exp3.kana);
  const html3After = renderTemplateToString(
    renderTeFormDojo(
      w3,
      p3,
      host,
      () => {},
      () => {},
    ),
  );
  const sub3After = html3After.split('class="dojo-verb-sub"')[1]?.split('</div>')[0] ?? '';
  assert.ok(
    sub3After.includes(exp3.kana),
    'Week 3 verb card metadata displays nai-form after card is revealed',
  );

  // 4. Week 4 (ta-form): card metadata (.dojo-verb-sub) hides target form before reveal, shows after
  const w4 = getCourseWeekById('week-4');
  const p4 = createFreshCourseProgress();
  studyDrills.reset();
  const cur4 = studyDrills.dojo.read(w4, courseWeeks, p4).current;
  const exp4 = getDojoExpectedForm(cur4);

  const html4Before = renderTemplateToString(
    renderTeFormDojo(
      w4,
      p4,
      host,
      () => {},
      () => {},
    ),
  );
  const sub4Before = html4Before.split('class="dojo-verb-sub"')[1]?.split('</div>')[0] ?? '';
  assert.ok(
    !sub4Before.includes(exp4.kana),
    'Week 4 verb card metadata must not display ta-form before reveal',
  );

  studyDrills.dojo.submit(exp4.kana);
  const html4After = renderTemplateToString(
    renderTeFormDojo(
      w4,
      p4,
      host,
      () => {},
      () => {},
    ),
  );
  const sub4After = html4After.split('class="dojo-verb-sub"')[1]?.split('</div>')[0] ?? '';
  assert.ok(
    sub4After.includes(exp4.kana),
    'Week 4 verb card metadata displays ta-form after card is revealed',
  );

  // Reset preferences
  setDojoPreferences({ inputMode: 'choices' });
  studyDrills.reset();
});

test('Genki Lesson 9 Content: 15 authentic kanji, 書く nakatta-form, and duplicate-free quiz questions', () => {
  const w4 = getCourseWeekById('week-4');

  // 1. 15 authentic Genki I Lesson 9 kanji
  const expectedL9Kanji = [
    '午',
    '前',
    '後',
    '名',
    '白',
    '雨',
    '書',
    '友',
    '間',
    '家',
    '話',
    '少',
    '古',
    '知',
    '来',
  ];
  assert.equal(w4.kanji.length, 15, 'Genki Lesson 9 has exactly 15 kanji');
  const actualL9Kanji = w4.kanji.map((k) => k.kanji);
  assert.deepEqual(
    actualL9Kanji,
    expectedL9Kanji,
    'Kanji list matches authentic Genki I L9 kanji in order',
  );

  // Verify that later/duplicate kanji are not in L9
  const forbiddenKanji = ['朝', '昼', '夜', '医', '者', '乗', '降', '開', '閉', '出', '入'];
  for (const fk of forbiddenKanji) {
    assert.ok(!actualL9Kanji.includes(fk), `Lesson 9 must not contain non-L9 kanji ${fk}`);
  }

  // Verify fields for each kanji
  for (const k of w4.kanji) {
    assert.ok(k.strokes > 0, `${k.kanji} has stroke count > 0`);
    assert.ok(k.onyomi.length > 0 || k.kunyomi.length > 0, `${k.kanji} has readings`);
    assert.ok(k.meaningSv.trim().length > 0, `${k.kanji} has Swedish meaning`);
    assert.ok(k.mnemonicSv.trim().length > 0, `${k.kanji} has Swedish mnemonic`);
    assert.ok(k.compounds.length >= 2, `${k.kanji} has at least 2 compounds`);
    for (const c of k.compounds) {
      assert.ok(c.word && c.reading && c.sv, `${k.kanji} compound has word, reading and sv`);
    }
  }

  // 2. 書く has correct nakatta-form (かかなかった)
  const kaku = w4.conjugations.find((c) => c.dictionaryKanji === '書く');
  assert.ok(kaku, '書く verb exists in Week 4 conjugations');
  assert.equal(kaku.nakattaFormKana, 'かかなかった', '書く nakattaFormKana is かかなかった');
  assert.equal(kaku.nakattaFormKanji, '書かなかった');

  // 3. All quiz questions across all course weeks have unique choices
  for (const week of courseWeeks) {
    for (const q of week.quiz) {
      const choiceSet = new Set(q.choices);
      assert.equal(
        choiceSet.size,
        q.choices.length,
        `Quiz question ${q.id} in ${week.id} must have unique choices without duplicates`,
      );
      assert.ok(
        q.choices.includes(q.answer),
        `Quiz question ${q.id} choices must include the correct answer`,
      );
    }
  }

  // 4. Week 4 w4-q08 specifically
  const q08 = w4.quiz.find((q) => q.id === 'w4-q08');
  assert.ok(q08, 'w4-q08 exists');
  assert.equal(q08.choices.length, 4, 'w4-q08 has 4 choices');
  assert.equal(new Set(q08.choices).size, 4, 'w4-q08 has 4 unique choices');
  assert.equal(q08.answer, 'いかなかった (行かなかった)');
});
