import test from 'node:test';
import assert from 'node:assert/strict';
import { courseWeeks, getCourseWeekById } from '../src/course/data/index.ts';
import {
  courseStorageKey,
  createFreshCourseProgress,
  getWeekMedalTier,
  getWeekProgressSummary,
  readCourseProgress,
  recordWeekQuizScore,
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
  assert.equal(w3.kanji.length, 14, 'Lesson 8 has complete 14 kanji list');
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

  progress.updatedAt = Date.now();
  storage.setItem(courseStorageKey('user-123'), JSON.stringify(progress));
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

test('Dojo Choices: Hiragana in focus, clear slash separator and kanji variant on revealed answer', () => {
  const host = { render: () => {}, speak: () => {}, tts: false };
  const w1 = getCourseWeekById('week-1');
  const p1 = createFreshCourseProgress();
  studyDrills.reset();
  setDojoPreferences({ inputMode: 'choices' });

  // 1. Before reveal: buttons show hiragana choice without slash or kanji variant
  const htmlBefore = renderTemplateToString(
    renderTeFormDojo(
      w1,
      p1,
      host,
      () => {},
      () => {},
    ),
  );
  assert.ok(htmlBefore.includes('class="dojo-choice-kana"'));
  assert.ok(!htmlBefore.includes('class="dojo-choice-sep"'));
  assert.ok(!htmlBefore.includes('class="dojo-choice-kanji"'));

  // 2. Submit correct answer: revealed answer displays hiragana + slash separator + kanji variant
  const cur = studyDrills.dojo.read(w1, courseWeeks, p1).current;
  const exp = getDojoExpectedForm(cur);
  studyDrills.dojo.submit(exp.kana);

  const htmlAfter = renderTemplateToString(
    renderTeFormDojo(
      w1,
      p1,
      host,
      () => {},
      () => {},
    ),
  );

  if (exp.kanji && exp.kanji !== exp.kana) {
    assert.ok(
      htmlAfter.includes('class="dojo-choice-sep"'),
      'Revealed correct choice must include separator',
    );
    assert.ok(
      htmlAfter.includes('class="dojo-choice-kanji"'),
      'Revealed correct choice must include kanji variant container',
    );
    assert.ok(htmlAfter.includes(exp.kanji), 'Revealed correct choice must include kanji variant');
    assert.ok(
      htmlAfter.includes(`aria-label="${exp.kana} / ${exp.kanji}"`),
      'Button aria-label clearly expresses both alternatives',
    );
  }

  // 3. Showcase displays kana first in .dojo-verb-kana, followed by kanji in .dojo-verb-kanji
  assert.ok(
    htmlBefore.includes(`<span class="dojo-verb-kana">${cur.dictionaryKana}</span>`),
    'Showcase displays dictionary kana first',
  );
  if (cur.dictionaryKanji && cur.dictionaryKanji !== cur.dictionaryKana) {
    assert.ok(
      htmlBefore.includes(`<span class="dojo-verb-kanji">（${cur.dictionaryKanji}）</span>`),
      'Showcase displays dictionary kanji secondary in parentheses',
    );
  }

  // 4. Input mode switch (Flerval / Skriv själv) is rendered inside .dojo-arena-meta
  const metaSection =
    htmlBefore.split('class="dojo-arena-meta"')[1]?.split('<div class="dojo-verb-showcase">')[0] ??
    '';
  assert.ok(
    metaSection.includes('aria-label="Svarsläge"'),
    'Svarsläge switch is placed in arena meta header',
  );
  assert.ok(
    metaSection.includes('Flerval') && metaSection.includes('Skriv själv'),
    'Svarsläge buttons are inside arena meta',
  );

  // Reset
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

test('Genki Course Data Quality: Authentic L6-L9 vocabulary, kanji and no slashed entries', () => {
  // 1. Inga glosor innehåller '/' eller '／' i kana eller kanji
  for (const week of courseWeeks) {
    for (const v of week.vocab) {
      assert.ok(
        !v.kana.includes('/') && !v.kana.includes('／'),
        `Vocab ${v.id} in ${week.id} (${v.kana}) must not contain slashes in kana`,
      );
      if (v.kanji) {
        assert.ok(
          !v.kanji.includes('/') && !v.kanji.includes('／'),
          `Vocab ${v.id} in ${week.id} (${v.kanji}) must not contain slashes in kanji`,
        );
      }
    }
  }

  // 2. Dela upp sammanslagna snedstrecksglosor till separata poster och inkludera centrala L7-ord
  const w2 = getCourseWeekById('week-2');
  const w2Words = w2.vocab.map((v) => v.kanji ?? v.kana);
  const expectedL7Words = [
    '父',
    '母',
    '兄',
    '姉',
    '弟',
    '妹',
    '一人',
    '二人',
    '家族',
    '兄弟',
    '歌',
    '会社',
    '食堂',
    'めがね',
    '車',
  ];
  for (const expected of expectedL7Words) {
    assert.ok(w2Words.includes(expected), `Lesson 7 must contain distinct vocab item ${expected}`);
  }

  // 3. Inga oavsiktliga korsveckodubbletter mellan L6 och L8
  const w1 = getCourseWeekById('week-1');
  const w3 = getCourseWeekById('week-3');
  const w1Keys = new Set(w1.vocab.map((v) => v.kanji ?? v.kana));
  const l6ExclusionsFromL8 = [
    'お金',
    'お風呂',
    '漢字',
    '教科書',
    '今週',
    '市民病院',
    '次',
    '電車',
    '荷物',
    'パソコン',
    '忘れる',
  ];
  for (const excl of l6ExclusionsFromL8) {
    assert.ok(w1Keys.has(excl), `Lesson 6 must contain authentic item ${excl}`);
    assert.ok(
      !w3.vocab.some((v) => (v.kanji ?? v.kana) === excl),
      `Lesson 8 must not duplicate Lesson 6 item ${excl}`,
    );
  }

  // 4. Kanji 何 finns i L8 kanjibank med korrekta egenskaper
  assert.equal(w3.kanji.length, 14, 'Genki Lesson 8 has exactly 14 kanji');
  const nan = w3.kanji.find((k) => k.kanji === '何');
  assert.ok(nan, 'Kanji 何 exists in Lesson 8 kanjibank');
  assert.equal(nan.strokes, 7, '何 has 7 strokes');
  assert.ok(nan.onyomi.includes('か'), '何 has onyomi か');
  assert.ok(
    nan.kunyomi.includes('なに') && nan.kunyomi.includes('なん'),
    '何 has kunyomi なに and なん',
  );
  const compoundWords = nan.compounds.map((c) => c.word);
  assert.ok(compoundWords.includes('何'), '何 has compound 何');
  assert.ok(compoundWords.includes('何時'), '何 has compound 何時');
  assert.ok(compoundWords.includes('何人'), '何 has compound 何人');

  // 5. Lektion 6 har ifyllda kanji-fält för relevanta ord
  const requiredL6Kanji = [
    '漢字',
    '教科書',
    '次',
    'お金',
    '荷物',
    '電気',
    '窓',
    '電車',
    '国',
    '今週',
    '来週',
    '来年',
    '夜',
    '大変',
    '遊ぶ',
    '急ぐ',
    '返す',
    '消す',
    '死ぬ',
    '座る',
    '立つ',
    '使う',
    '手伝う',
    '入る',
    '持つ',
    '休む',
    '開ける',
    '閉める',
    '教える',
    '忘れる',
    '降りる',
    '借りる',
    '電話する',
    '連れてくる',
    '持ってくる',
    '後で',
    '結構です',
    '本当ですか',
    '市民病院',
    'お風呂',
  ];
  for (const k of requiredL6Kanji) {
    assert.ok(
      w1.vocab.some((v) => v.kanji === k),
      `Lesson 6 vocab must have kanji field filled for ${k}`,
    );
  }

  // 6. Flyttade L8-glosor finns i L8 och inte i L9
  const w4 = getCourseWeekById('week-4');
  for (const moved of ['ギター', '今月', '薬', '弾く']) {
    assert.ok(
      w3.vocab.some((v) => v.kana === moved || v.kanji === moved),
      `Lesson 8 must include moved item ${moved}`,
    );
    assert.ok(
      !w4.vocab.some((v) => v.kana === moved || v.kanji === moved),
      `Lesson 9 must not include moved item ${moved}`,
    );
  }

  // 7. Lektion 9 har autentiska glosor och inga snedstreck
  for (const expectedL9 of [
    '保険証',
    '映画館',
    'ところ',
    'お弁当',
    '温泉',
    '始まる',
    '決める',
    '運動する',
    '散歩する',
    'もう',
    'まだ',
  ]) {
    assert.ok(
      w4.vocab.some((v) => v.kana === expectedL9 || v.kanji === expectedL9),
      `Lesson 9 must include authentic vocab ${expectedL9}`,
    );
  }

  // 8. Inga exempelmeningar använder Genki II volitional form (走ろう)
  for (const g of w4.grammar) {
    assert.ok(
      !JSON.stringify(g).includes('走ろう'),
      'Grammar must not contain Genki II volitional 走ろう',
    );
  }
});

test('Quiz Mistake Coupling: All quiz questions with vocabId and conjugationId map to valid items in the week', () => {
  let vocabCoupledCount = 0;
  let dojoCoupledCount = 0;

  for (const week of courseWeeks) {
    for (const q of week.quiz) {
      if (q.vocabId) {
        vocabCoupledCount++;
        const found = week.vocab.find((v) => v.id === q.vocabId);
        assert.ok(
          found,
          `Week ${week.id} question ${q.id} vocabId ${q.vocabId} must exist in week.vocab`,
        );
      }
      if (q.conjugationId) {
        dojoCoupledCount++;
        const found = week.conjugations.find((c) => c.id === q.conjugationId);
        assert.ok(
          found,
          `Week ${week.id} question ${q.id} conjugationId ${q.conjugationId} must exist in week.conjugations`,
        );
      }
    }
  }

  assert.ok(vocabCoupledCount >= 8, 'At least 8 quiz questions are explicitly coupled to vocab');
  assert.ok(
    dojoCoupledCount >= 8,
    'At least 8 quiz questions are explicitly coupled to conjugations',
  );
});

test('Ticket 07: Samtliga verb i Vecka 1–4 har definierade te-, nai- och ta-former', () => {
  let totalVerbs = 0;
  for (const week of courseWeeks) {
    assert.ok(week.conjugations.length > 0, `Week ${week.id} must have conjugations`);
    for (const conj of week.conjugations) {
      totalVerbs++;
      assert.ok(
        conj.teFormKana && conj.teFormKana.trim().length > 0,
        `Verb ${conj.id} (${conj.dictionaryKana}) in ${week.id} missing teFormKana`,
      );
      assert.ok(
        conj.teFormKanji && conj.teFormKanji.trim().length > 0,
        `Verb ${conj.id} (${conj.dictionaryKana}) in ${week.id} missing teFormKanji`,
      );
      assert.ok(
        conj.naiFormKana && conj.naiFormKana.trim().length > 0,
        `Verb ${conj.id} (${conj.dictionaryKana}) in ${week.id} missing naiFormKana`,
      );
      assert.ok(
        conj.naiFormKanji && conj.naiFormKanji.trim().length > 0,
        `Verb ${conj.id} (${conj.dictionaryKana}) in ${week.id} missing naiFormKanji`,
      );
      assert.ok(
        conj.taFormKana && conj.taFormKana.trim().length > 0,
        `Verb ${conj.id} (${conj.dictionaryKana}) in ${week.id} missing taFormKana`,
      );
      assert.ok(
        conj.taFormKanji && conj.taFormKanji.trim().length > 0,
        `Verb ${conj.id} (${conj.dictionaryKana}) in ${week.id} missing taFormKanji`,
      );
    }
  }
  assert.equal(totalVerbs, 46, 'Total of 46 verbs across Lessons 6–9 all have full conjugations');
});

test('Ticket 07: Arenans böjningsfrågor testar rätt fokusform per vecka (te för W1-2, nai för W3, ta för W4)', () => {
  // Test individual week generation
  for (const weekId of ['week-1', 'week-2', 'week-3', 'week-4'] as const) {
    const questions = buildAllCourseArenaQuestions(weekId);
    const conjQuestions = questions.filter(
      (q) => q.category === 'te-form' && q.id.startsWith('aq-te-'),
    );
    assert.ok(conjQuestions.length > 0, `${weekId} must have arena conjugation questions`);

    for (const q of conjQuestions) {
      if (weekId === 'week-1' || weekId === 'week-2') {
        assert.ok(
          q.prompt.includes('て-form'),
          `${weekId} question prompt "${q.prompt}" must ask for て-form`,
        );
        assert.ok(
          q.badgeLabel.includes('て-form Dojo'),
          `${weekId} badge "${q.badgeLabel}" must specify て-form Dojo`,
        );
      } else if (weekId === 'week-3') {
        assert.ok(
          q.prompt.includes('ない-form'),
          `Week 3 question prompt "${q.prompt}" must ask for ない-form`,
        );
        assert.ok(
          q.badgeLabel.includes('ない-form Dojo'),
          `Week 3 badge "${q.badgeLabel}" must specify ない-form Dojo`,
        );
      } else if (weekId === 'week-4') {
        assert.ok(
          q.prompt.includes('た-form'),
          `Week 4 question prompt "${q.prompt}" must ask for た-form`,
        );
        assert.ok(
          q.badgeLabel.includes('た-form Dojo'),
          `Week 4 badge "${q.badgeLabel}" must specify た-form Dojo`,
        );
      }
      assert.ok(
        q.choices.includes(q.answer),
        `Question ${q.id} choices must include correct answer`,
      );
      assert.equal(new Set(q.choices).size, 4, `Question ${q.id} must have 4 unique choices`);
    }
  }

  // Verify generateArenaQuestionDeck preserves focus forms
  const w3Deck = generateArenaQuestionDeck({
    weekFilter: 'week-3',
    focusMode: 'te-form',
    roundCount: 10,
  });
  assert.equal(w3Deck.length, 10);
  assert.ok(
    w3Deck.every((q) => q.prompt.includes('ない-form') || q.category === 'te-form'),
    'Week 3 arena deck tests nai-form',
  );

  const w4Deck = generateArenaQuestionDeck({
    weekFilter: 'week-4',
    focusMode: 'te-form',
    roundCount: 10,
  });
  assert.equal(w4Deck.length, 10);
  assert.ok(
    w4Deck.every((q) => q.prompt.includes('た-form') || q.category === 'te-form'),
    'Week 4 arena deck tests ta-form',
  );
});

test('Ticket 07: Dojon behåller konsekvent målform vid filterbyte och stödjer explicit målformsval', () => {
  const p = createFreshCourseProgress();
  const w1 = getCourseWeekById('week-1');
  const w3 = getCourseWeekById('week-3');
  const w4 = getCourseWeekById('week-4');

  // 1. In Week 1 Dojo, switching to "Alla veckor" maintains te-form across all verbs
  studyDrills.reset();
  const drills = studyDrills;
  let s1 = drills.dojo.read(w1, courseWeeks, p);
  assert.equal(s1.targetForm, 'te', 'Week 1 defaults to te-form');
  assert.equal(s1.expected.kana, 'かって', 'First verb 買う expects かって');

  drills.dojo.selectFilter('all');
  s1 = drills.dojo.read(w1, courseWeeks, p);
  assert.equal(s1.targetForm, 'te', 'Filtering to all weeks keeps targetForm te');

  // Verify all cards in "all" filter stay on te-form and do not flip to nai/ta
  for (let i = 0; i < s1.total; i++) {
    const card = drills.dojo.read(w1, courseWeeks, p);
    assert.equal(
      card.targetForm,
      'te',
      `Verb ${card.current.id} in "all" filter from Week 1 must keep targetForm te`,
    );
    assert.equal(
      card.expected.kana,
      card.current.teFormKana,
      `Verb ${card.current.id} must expect te-form (${card.current.teFormKana})`,
    );
    assert.ok(
      card.choices.includes(card.current.teFormKana),
      `Verb ${card.current.id} choices must include teFormKana`,
    );
    drills.dojo.move(1);
  }

  // 2. In Week 3 Dojo, default targetForm is nai, and switching to "Alla veckor" maintains nai-form
  studyDrills.reset();
  let s3 = drills.dojo.read(w3, courseWeeks, p);
  assert.equal(s3.targetForm, 'nai', 'Week 3 defaults to nai-form');
  drills.dojo.selectFilter('all');
  s3 = drills.dojo.read(w3, courseWeeks, p);
  assert.equal(s3.targetForm, 'nai', 'Week 3 "all" filter maintains nai-form');

  for (let i = 0; i < s3.total; i++) {
    const card = drills.dojo.read(w3, courseWeeks, p);
    assert.equal(
      card.targetForm,
      'nai',
      `Verb ${card.current.id} in "all" filter from Week 3 must keep targetForm nai`,
    );
    assert.equal(
      card.expected.kana,
      card.current.naiFormKana,
      `Verb ${card.current.id} must expect nai-form (${card.current.naiFormKana})`,
    );
    assert.ok(
      card.choices.includes(card.current.naiFormKana!),
      `Verb ${card.current.id} choices must include naiFormKana`,
    );
    drills.dojo.move(1);
  }

  // 3. In Week 4 Dojo, default targetForm is ta, and switching to "Alla veckor" maintains ta-form
  studyDrills.reset();
  let s4 = drills.dojo.read(w4, courseWeeks, p);
  assert.equal(s4.targetForm, 'ta', 'Week 4 defaults to ta-form');
  drills.dojo.selectFilter('all');
  s4 = drills.dojo.read(w4, courseWeeks, p);
  assert.equal(s4.targetForm, 'ta', 'Week 4 "all" filter maintains ta-form');

  for (let i = 0; i < s4.total; i++) {
    const card = drills.dojo.read(w4, courseWeeks, p);
    assert.equal(
      card.targetForm,
      'ta',
      `Verb ${card.current.id} in "all" filter from Week 4 must keep targetForm ta`,
    );
    assert.equal(
      card.expected.kana,
      card.current.taFormKana,
      `Verb ${card.current.id} must expect ta-form (${card.current.taFormKana})`,
    );
    assert.ok(
      card.choices.includes(card.current.taFormKana!),
      `Verb ${card.current.id} choices must include taFormKana`,
    );
    drills.dojo.move(1);
  }

  // 4. Explicit target form selection overrides default and persists through filter switches
  studyDrills.reset();
  drills.dojo.read(w1, courseWeeks, p);
  drills.dojo.selectTargetForm('nai');
  let explicitState = drills.dojo.read(w1, courseWeeks, p);
  assert.equal(explicitState.targetForm, 'nai', 'Explicit selection sets nai-form on Week 1');
  assert.equal(explicitState.expected.kana, 'かわない', '買う expects かわない when nai selected');

  drills.dojo.selectFilter('all');
  explicitState = drills.dojo.read(w1, courseWeeks, p);
  assert.equal(
    explicitState.targetForm,
    'nai',
    'Explicit selection persists across filter change to all',
  );

  drills.dojo.selectTargetForm('ta');
  explicitState = drills.dojo.read(w1, courseWeeks, p);
  assert.equal(explicitState.targetForm, 'ta', 'Explicit selection switches to ta-form');
  assert.equal(explicitState.expected.kana, 'かった', '買う expects かった when ta selected');

  // Submitting against explicit form awards mastery correctly
  const cmd = drills.dojo.submit('かった');
  assert.equal(cmd?.mastered, true, 'Submitting correct ta-form is mastered');
});
