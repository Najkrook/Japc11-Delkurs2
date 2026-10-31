import test from 'node:test';
import assert from 'node:assert/strict';
import { courseWeeks, getCourseWeekById } from '../src/course/data/index.ts';
import { getDojoExpectedForm, getWeekDefaultTargetForm } from '../src/course/study-drills.ts';
import { buildAllCourseArenaQuestions } from '../src/course/multiplayer/arena-questions.ts';
import { parseRoute } from '../src/course/router.ts';
import {
  courseStorageKey,
  createFreshCourseProgress,
  readCourseProgress,
  getWeekProgressSummary,
} from '../src/course/course-state.ts';

test('Genki I third edition: seven ordered weeks, existing preview behavior, exact L10–12 kanji sets', () => {
  assert.deepEqual(
    courseWeeks.map((w) => [w.id, w.weekNumber, w.lessonNumber, !!w.isPreview]),
    Array.from({ length: 7 }, (_, i) => [`week-${i + 1}`, i + 1, i + 6, i >= 2]),
  );
  assert.equal(
    getCourseWeekById('week-5')
      .kanji.map((k) => k.kanji)
      .join(''),
    '住正年売買町長道雪立自夜朝持',
  );
  assert.equal(
    getCourseWeekById('week-6')
      .kanji.map((k) => k.kanji)
      .join(''),
    '手紙好近明病院映画歌市所勉強有旅',
  );
  assert.equal(
    getCourseWeekById('week-7')
      .kanji.map((k) => k.kanji)
      .join(''),
    '昔々神早起牛使働連別度赤青色',
  );
});

test('New weeks have substantive content, unique identifiers, and valid quiz references and choices', () => {
  // Existing saved identifiers must not be renamed by this course extension.
  const ids = new Set(
    courseWeeks
      .slice(0, 4)
      .flatMap((w) =>
        [...w.vocab, ...w.grammar, ...w.conjugations, ...w.kanji, ...w.quiz].map((item) => item.id),
      ),
  );
  for (const week of courseWeeks.slice(4)) {
    for (const item of [
      ...week.vocab,
      ...week.grammar,
      ...week.conjugations,
      ...week.kanji,
      ...week.quiz,
    ]) {
      assert.ok(!ids.has(item.id), `Duplicate ID ${item.id}`);
      ids.add(item.id);
      assert.equal(item.weekId, week.id);
      if ('lesson' in item) assert.equal(item.lesson, week.lessonNumber);
    }
  }
  for (const week of courseWeeks.slice(4)) {
    assert.ok(week.vocab.length >= 25);
    assert.ok(week.conjugations.length >= 10);
    assert.ok(week.grammar.length >= 4);
    assert.ok(week.quiz.length >= 12);
    assert.ok(week.objectivesSv.length >= 4);
    for (const v of week.vocab)
      for (const value of [v.kana, v.sv, v.en, v.exampleJp, v.exampleSv]) assert.ok(value.trim());
    for (const g of week.grammar) {
      assert.ok(g.explanationSv && g.patternJp && g.formationRules.length >= 2);
      assert.ok(g.examples.length >= 2);
      for (const e of g.examples) assert.ok(e.jp && e.kana && e.sv);
    }
    for (const k of week.kanji) {
      assert.ok(k.strokes > 0 && k.mnemonicSv && k.meaningSv);
      assert.ok(k.compounds.length >= 2);
      for (const c of k.compounds) assert.ok(c.word && c.reading && c.sv);
    }
    for (const q of week.quiz) {
      assert.equal(q.choices.length, 4, q.id);
      assert.equal(new Set(q.choices).size, 4, q.id);
      assert.ok(q.choices.includes(q.answer), q.id);
      assert.ok(q.prompt && q.explanationSv);
      if (q.vocabId)
        assert.ok(
          week.vocab.some((v) => v.id === q.vocabId),
          q.id,
        );
      if (q.kanjiId)
        assert.ok(
          week.kanji.some((k) => k.id === q.kanjiId),
          q.id,
        );
      if (q.conjugationId)
        assert.ok(
          week.conjugations.some((c) => c.id === q.conjugationId),
          q.id,
        );
    }
  }
});

test('Authored verbs retain correct regular, irregular, phrase and exceptional conjugations', () => {
  const cases = [
    ['week-5', 'いく', 'いって', 'いかない', 'いった', '行きます'],
    ['week-5', 'かえる', 'かえって', 'かえらない', 'かえった', '帰ります'],
    ['week-5', 'きめる', 'きめて', 'きめない', 'きめた', '決めます'],
    ['week-6', 'うたう', 'うたって', 'うたわない', 'うたった', '歌います'],
    [
      'week-6',
      'りゅうがくする',
      'りゅうがくして',
      'りゅうがくしない',
      'りゅうがくした',
      '留学します',
    ],
    ['week-7', 'せきがでる', 'せきがでて', 'せきがでない', 'せきがでた', 'せきが出ます'],
    ['week-7', 'のむ', 'のんで', 'のまない', 'のんだ', '飲みます'],
    ['week-7', 'なくす', 'なくして', 'なくさない', 'なくした', 'なくします'],
  ];
  for (const [weekId, kana, te, nai, ta, masu] of cases) {
    const c = getCourseWeekById(weekId).conjugations.find((v) => v.dictionaryKana === kana)!;
    assert.deepEqual(
      [c.teFormKana, c.naiFormKana, c.taFormKana, c.politeMasu],
      [te, nai, ta, masu],
      kana,
    );
  }
});

test('New routes, Dojo focus and Arena filters agree for all preview weeks', () => {
  for (const [weekId, form] of [
    ['week-5', 'nai'],
    ['week-6', 'ta'],
    ['week-7', 'nai'],
  ] as const) {
    const week = getCourseWeekById(weekId);
    assert.deepEqual(parseRoute(`#/vecka/${weekId}/dojo`), { weekId, subView: 'dojo' });
    assert.equal(getWeekDefaultTargetForm(weekId), form);
    const bank = buildAllCourseArenaQuestions(weekId);
    assert.ok(bank.length > week.quiz.length);
    assert.ok(bank.every((q) => q.weekId === weekId && q.lessonNumber === week.lessonNumber));
    for (const c of week.conjugations) {
      const q = bank.find((q) => q.id === `aq-te-${c.id}`)!;
      assert.equal(q.answer, getDojoExpectedForm(c).kana);
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4);
      assert.ok(q.choices.includes(q.answer));
    }
  }
  assert.deepEqual(
    new Set(buildAllCourseArenaQuestions().map((q) => q.weekId)),
    new Set(courseWeeks.map((w) => w.id)),
  );
});

test('Saved old progress and new-week progress coexist without migration', () => {
  const data = createFreshCourseProgress();
  data.activeWeekId = 'week-7';
  data.masteredVocabIds = { 'w1-v01': true, 'w7-v01': true };
  data.masteredDojoIds = { 'w6-c01': true };
  data.quizBestResults['week-5'] = { score: 14, total: 14, completedAt: 123 };
  const restored = readCourseProgress({
    getItem: (key) => (key === courseStorageKey() ? JSON.stringify(data) : null),
  });
  assert.deepEqual(restored, data);
  assert.equal(getWeekProgressSummary(restored, getCourseWeekById('week-7')).vocabDone, 1);
  assert.equal(getWeekProgressSummary(restored, getCourseWeekById('week-6')).dojoDone, 1);
  assert.equal(getWeekProgressSummary(restored, getCourseWeekById('week-5')).quizScore, 14);
  assert.equal(restored.masteredVocabIds['w1-v01'], true);
});
