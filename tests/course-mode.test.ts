import test from 'node:test';
import assert from 'node:assert/strict';
import { courseWeeks, getCourseWeekById } from '../src/course/data/index.ts';
import {
  createFreshCourseProgress,
  getWeekProgressSummary,
  readCourseProgress,
  recordWeekQuizScore,
  saveCourseProgress,
  setCourseActiveWeek,
  setDojoMastered,
  toggleKanjiMastered,
  toggleVocabMastered,
} from '../src/course/course-state.ts';
import { buildDojoChoices } from '../src/course/components/te-form-dojo.ts';
import {
  buildAllCourseArenaQuestions,
  calculateArenaPoints,
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

test('Te-Form Dojo: Generates 4 unique choices including the correct te-form', () => {
  for (const week of courseWeeks) {
    for (const item of week.conjugations) {
      const choices = buildDojoChoices(item);
      assert.equal(choices.length, 4, `4 choices for ${item.dictionaryKanji}`);
      assert.ok(
        choices.includes(item.teFormKana),
        `Includes correct answer ${item.teFormKana} for ${item.dictionaryKanji}`,
      );
    }
  }
});

test('Course Arena Multiplayer: Generates L6-L9 decks and calculates time-bonus points', () => {
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

  assert.equal(calculateArenaPoints(false, 12000, 15000, 3), 0);
  assert.equal(calculateArenaPoints(true, 15000, 15000, 0), 1000);
  assert.equal(calculateArenaPoints(true, 7500, 15000, 2), 950);

  const code = generateRoomCode();
  assert.match(code, /^\d{4}$/);
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
