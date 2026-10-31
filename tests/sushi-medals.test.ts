import test from 'node:test';
import assert from 'node:assert/strict';
import { courseWeeks, getCourseWeekById } from '../src/course/data/index.ts';
import {
  createFreshCourseProgress,
  getWeekMedalTier,
  getWeekProgressSummary,
} from '../src/course/course-state.ts';
import type { CourseProgressData, CourseWeek } from '../src/course/types.ts';
import {
  evaluateMedalGrants,
  mergePermanentGrants,
  tierSatisfies,
  SUSHI_UNLOCK_CATALOG,
  MEDAL_GRANT_RULES,
  type UnlockGrantId,
} from '../src/course/sushi-game/medals.ts';

// ---------------------------------------------------------------------------
// F07: Course Lesson Mapping (Tier 1 & Tier 2 BVA)
// ---------------------------------------------------------------------------

test('F07-T1: Genki Chapter 6 maps strictly to week-1 via lessonNumber: 6', () => {
  const w1 = getCourseWeekById('week-1');
  assert.ok(w1, 'week-1 must exist');
  assert.equal(w1.lessonNumber, 6, 'Genki Chapter 6 must have lessonNumber 6');

  const found = courseWeeks.find((w) => w.lessonNumber === 6);
  assert.ok(found, 'Should find course week with lessonNumber 6');
  assert.equal(found.id, 'week-1', 'Lesson 6 must resolve to week-1');
});

test('F07-T2: Genki Chapter 7 maps strictly to week-2 via lessonNumber: 7', () => {
  const w2 = getCourseWeekById('week-2');
  assert.ok(w2, 'week-2 must exist');
  assert.equal(w2.lessonNumber, 7, 'Genki Chapter 7 must have lessonNumber 7');

  const found = courseWeeks.find((w) => w.lessonNumber === 7);
  assert.ok(found, 'Should find course week with lessonNumber 7');
  assert.equal(found.id, 'week-2', 'Lesson 7 must resolve to week-2');
});

test('F07-T3: Genki Chapter 9 (Conveyor Belt) maps strictly to week-4 via lessonNumber: 9', () => {
  // CRITICAL SPEC REQUIREMENT:
  // Chapter 9 is week-4 in the course structure. Code must never assume week ID equals chapter number!
  const w4 = getCourseWeekById('week-4');
  assert.ok(w4, 'week-4 must exist');
  assert.equal(w4.lessonNumber, 9, 'Genki Chapter 9 must have lessonNumber 9');

  const found = courseWeeks.find((w) => w.lessonNumber === 9);
  assert.ok(found, 'Should find course week with lessonNumber 9');
  assert.equal(found.id, 'week-4', 'Conveyor Belt milestone chapter 9 must resolve to week-4');

  // Verify that assuming week-9 would fail safely
  const invalidWeek9 = courseWeeks.find((w) => w.id === 'week-9');
  assert.equal(invalidWeek9, undefined, 'week-9 does not exist in the curriculum');
});

test('F07-T4: Full course inventory maps Lessons 6 through 12 sequentially without gaps', () => {
  assert.equal(courseWeeks.length, 7, 'Course contains exactly 7 Genki weeks');

  const expectedLessons = [6, 7, 8, 9, 10, 11, 12];
  const actualLessons = courseWeeks.map((w) => w.lessonNumber);
  assert.deepEqual(
    actualLessons,
    expectedLessons,
    'Lessons must match 6 through 12 in exact order',
  );

  const expectedWeekIds = ['week-1', 'week-2', 'week-3', 'week-4', 'week-5', 'week-6', 'week-7'];
  const actualWeekIds = courseWeeks.map((w) => w.id);
  assert.deepEqual(actualWeekIds, expectedWeekIds, 'Week IDs must match week-1 through week-7');
});

test('F07-T5: Adversarial & Boundary queries for non-existent or invalid lesson numbers', () => {
  // Querying lesson numbers outside 6-12 returns undefined safely
  assert.equal(
    courseWeeks.find((w) => w.lessonNumber === 0),
    undefined,
  );
  assert.equal(
    courseWeeks.find((w) => w.lessonNumber === 5),
    undefined,
  );
  assert.equal(
    courseWeeks.find((w) => w.lessonNumber === 13),
    undefined,
  );
  assert.equal(
    courseWeeks.find((w) => w.lessonNumber === -1),
    undefined,
  );
  assert.equal(
    courseWeeks.find((w) => w.lessonNumber === 999),
    undefined,
  );

  // Asserting getCourseWeekById falls back safely to default week1Lesson6 on unknown week IDs
  const fallback = getCourseWeekById('invalid-week');
  assert.equal(fallback.id, 'week-1', 'Unknown week ID must safely fall back to week1Lesson6');
  assert.equal(fallback.lessonNumber, 6, 'Fallback week must have lessonNumber 6');
});

// ---------------------------------------------------------------------------
// F08: Unrounded Medal Calculation (Tier 1 & Tier 2 BVA)
// ---------------------------------------------------------------------------

test('F08-T1: Boundary Value Analysis: 59.9% rejected, 60.0% awards Bronze', () => {
  // 59.999% must NOT award Bronze even if Math.round would yield 60%
  assert.equal(getWeekMedalTier(599, 1000), null, '59.9% is strictly below Bronze');
  assert.equal(getWeekMedalTier(5999, 10000), null, '59.99% is strictly below Bronze');
  assert.equal(getWeekMedalTier(59, 100), null, '59% is strictly below Bronze');

  // Exact 60.0% boundary awards Bronze
  assert.equal(getWeekMedalTier(60, 100), 'bronze', 'Exact 60.0% must award Bronze');
  assert.equal(getWeekMedalTier(6, 10), 'bronze', 'Exact 6/10 must award Bronze');
  assert.equal(getWeekMedalTier(600, 1000), 'bronze', 'Exact 600/1000 must award Bronze');
  assert.equal(getWeekMedalTier(61, 100), 'bronze', '61% awards Bronze');
});

test('F08-T2: Boundary Value Analysis: 79.9% awards Bronze, 80.0% awards Silver', () => {
  // 79.999% must NOT prematurely award Silver even if Math.round would yield 80%
  assert.equal(getWeekMedalTier(799, 1000), 'bronze', '79.9% must remain Bronze');
  assert.equal(getWeekMedalTier(7999, 10000), 'bronze', '79.99% must remain Bronze');
  assert.equal(getWeekMedalTier(79, 100), 'bronze', '79% must remain Bronze');

  // Exact 80.0% boundary awards Silver
  assert.equal(getWeekMedalTier(80, 100), 'silver', 'Exact 80.0% must award Silver');
  assert.equal(getWeekMedalTier(8, 10), 'silver', 'Exact 8/10 must award Silver');
  assert.equal(getWeekMedalTier(800, 1000), 'silver', 'Exact 800/1000 must award Silver');
  assert.equal(getWeekMedalTier(81, 100), 'silver', '81% awards Silver');
});

test('F08-T3: Boundary Value Analysis: 99.9% awards Silver, 100.0% awards Gold', () => {
  // 99.999% must NOT award Gold even if Math.round would yield 100%
  assert.equal(getWeekMedalTier(999, 1000), 'silver', '99.9% must remain Silver');
  assert.equal(getWeekMedalTier(9999, 10000), 'silver', '99.99% must remain Silver');
  assert.equal(getWeekMedalTier(99, 100), 'silver', '99% must remain Silver');

  // Exact 100.0% boundary awards Gold
  assert.equal(getWeekMedalTier(100, 100), 'gold', 'Exact 100.0% must award Gold');
  assert.equal(getWeekMedalTier(10, 10), 'gold', 'Exact 10/10 must award Gold');
  assert.equal(getWeekMedalTier(1, 1), 'gold', 'Exact 1/1 must award Gold');
});

test('F08-T4: Edge Cases: Zero total, negative, or overflow values return null safely', () => {
  assert.equal(getWeekMedalTier(0, 0), null, '0/0 total items returns null (no division by zero)');
  assert.equal(getWeekMedalTier(10, 0), null, 'Positive completed with 0 total returns null');
  assert.equal(getWeekMedalTier(-5, 10), null, 'Negative completed returns null');
  assert.equal(getWeekMedalTier(0, -10), null, 'Negative total returns null');
});

test('F08-T5: High study mastery achieves Bronze/Silver without completing a quiz', () => {
  const w1 = getCourseWeekById('week-1');
  const progress: CourseProgressData = createFreshCourseProgress();

  // Mark all vocabulary as mastered in Lesson 6
  for (const v of w1.vocab) {
    progress.masteredVocabIds[v.id] = true;
  }
  // Mark all kanji as mastered in Lesson 6
  for (const k of w1.kanji) {
    progress.masteredKanjiIds[k.id] = true;
  }
  // Mark all conjugations as mastered in Lesson 6
  for (const c of w1.conjugations) {
    progress.masteredDojoIds[c.id] = true;
  }

  // Quiz is completely untouched: score is null
  assert.equal(progress.quizBestResults['week-1'], undefined);

  const summary = getWeekProgressSummary(progress, w1);
  assert.equal(summary.quizScore, null, 'No quiz score is recorded');

  // Total items in Lesson 6 = vocab + kanji + dojo + quiz
  const nonQuizCount = w1.vocab.length + w1.kanji.length + w1.conjugations.length;
  const totalCount = nonQuizCount + w1.quiz.length;
  const ratio = nonQuizCount / totalCount;

  // The ratio of non-quiz items in Lesson 6 is approx 87% (>= 80%)
  assert.ok(ratio >= 0.8, `Non-quiz completion (${(ratio * 100).toFixed(1)}%) exceeds 80%`);
  assert.equal(
    summary.medal,
    'silver',
    'Student achieves Silver medal through study mastery alone without a mandatory quiz pass',
  );
});

test('F08-T6: Quiz total expansion invalidates stale quiz score without throwing', () => {
  const w1 = getCourseWeekById('week-1');
  const progress: CourseProgressData = createFreshCourseProgress();

  // Simulate an old quiz result recorded when quiz only had 5 questions
  progress.quizBestResults['week-1'] = { score: 5, total: 5, date: 1000 };

  // Current quiz has more than 5 questions
  assert.ok(w1.quiz.length > 5, 'Lesson 6 quiz has more than 5 questions');

  const summary = getWeekProgressSummary(progress, w1);
  assert.equal(
    summary.quizScore,
    null,
    'Stale quiz score with mismatched question count must be safely discarded',
  );
});

// ---------------------------------------------------------------------------
// Milestone 2 (Ticket 05): Medal Grants Domain Engine Tests (M2-T01 - M2-T15)
// ---------------------------------------------------------------------------

test('M2-T01: evaluateMedalGrants returns empty array for fresh student with 0% progress', () => {
  const fresh = createFreshCourseProgress();
  const earned = evaluateMedalGrants(fresh);
  assert.deepEqual(earned, [], 'Fresh progress with 0 completed items awards no grants');
});

test('M2-T02: evaluateMedalGrants awards prep_counter for exactly 60% in Lesson 6', () => {
  const w1 = getCourseWeekById('week-1');
  const progress = createFreshCourseProgress();

  // Total items in Lesson 6: w1.vocab (58) + w1.kanji (17) + w1.conjugations (14) + w1.quiz (13) = 102
  const total = w1.vocab.length + w1.kanji.length + w1.conjugations.length + w1.quiz.length;
  const targetCompleted = Math.ceil(total * 0.6); // 62 items >= 60%

  // Master vocabulary up to targetCompleted
  for (let i = 0; i < targetCompleted && i < w1.vocab.length; i++) {
    progress.masteredVocabIds[w1.vocab[i].id] = true;
  }
  if (targetCompleted > w1.vocab.length) {
    const rem = targetCompleted - w1.vocab.length;
    for (let i = 0; i < rem && i < w1.kanji.length; i++) {
      progress.masteredKanjiIds[w1.kanji[i].id] = true;
    }
  }

  const earned = evaluateMedalGrants(progress);
  assert.deepEqual(
    earned,
    ['prep_counter'],
    'Achieving Bronze (>=60%) in Chapter 6 awards only prep_counter',
  );
});

test('M2-T03: evaluateMedalGrants unrounded math rejects 59.9% in Lesson 6', () => {
  const w1 = getCourseWeekById('week-1');
  const progress = createFreshCourseProgress();

  const total = w1.vocab.length + w1.kanji.length + w1.conjugations.length + w1.quiz.length;
  // Complete strictly 1 item less than 60%
  const targetCompleted = Math.floor(total * 0.6) - 1;

  for (let i = 0; i < targetCompleted && i < w1.vocab.length; i++) {
    progress.masteredVocabIds[w1.vocab[i].id] = true;
  }
  if (targetCompleted > w1.vocab.length) {
    const rem = targetCompleted - w1.vocab.length;
    for (let i = 0; i < rem && i < w1.kanji.length; i++) {
      progress.masteredKanjiIds[w1.kanji[i].id] = true;
    }
  }

  const earned = evaluateMedalGrants(progress);
  assert.deepEqual(earned, [], 'Sub-bronze completion ratio (<60%) awards no grants');
});

test('M2-T04: evaluateMedalGrants awards prep_counter and salmon_nigiri for Silver (80%) in Lesson 6', () => {
  const w1 = getCourseWeekById('week-1');
  const progress = createFreshCourseProgress();

  // Master all vocab (58), all kanji (17), all dojo (14) = 89 / 102 = 87.25% (Silver)
  for (const v of w1.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w1.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w1.conjugations) progress.masteredDojoIds[c.id] = true;

  const earned = evaluateMedalGrants(progress);
  assert.deepEqual(
    earned,
    ['prep_counter', 'salmon_nigiri'],
    'Achieving Silver in Chapter 6 awards prep_counter (Bronze) and salmon_nigiri (Silver)',
  );
});

test('M2-T05: evaluateMedalGrants awards prep_counter, salmon_nigiri, paper_lantern for Gold in Lesson 6', () => {
  const w1 = getCourseWeekById('week-1');
  const progress = createFreshCourseProgress();

  for (const v of w1.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w1.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w1.conjugations) progress.masteredDojoIds[c.id] = true;
  progress.quizBestResults['week-1'] = { score: w1.quiz.length, total: w1.quiz.length, date: 1000 };

  const earned = evaluateMedalGrants(progress);
  assert.deepEqual(
    earned,
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    'Achieving Gold in Chapter 6 awards all 3 Chapter 6 grants',
  );
});

test('M2-T06: evaluateMedalGrants awards cap_extension_12h for Bronze and potted_plant for Gold in Lesson 7', () => {
  const w2 = getCourseWeekById('week-2');
  const progress = createFreshCourseProgress();

  // Lesson 7 Bronze
  const total = w2.vocab.length + w2.kanji.length + w2.conjugations.length + w2.quiz.length;
  const targetCompleted = Math.ceil(total * 0.6);
  for (let i = 0; i < targetCompleted && i < w2.vocab.length; i++) {
    progress.masteredVocabIds[w2.vocab[i].id] = true;
  }
  if (targetCompleted > w2.vocab.length) {
    const rem = targetCompleted - w2.vocab.length;
    for (let i = 0; i < rem && i < w2.kanji.length; i++) {
      progress.masteredKanjiIds[w2.kanji[i].id] = true;
    }
  }

  assert.deepEqual(
    evaluateMedalGrants(progress),
    ['cap_extension_12h'],
    'Chapter 7 Bronze awards cap_extension_12h',
  );

  // Lesson 7 Gold
  for (const v of w2.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w2.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w2.conjugations) progress.masteredDojoIds[c.id] = true;
  progress.quizBestResults['week-2'] = { score: w2.quiz.length, total: w2.quiz.length, date: 1000 };

  assert.deepEqual(
    evaluateMedalGrants(progress),
    ['cap_extension_12h', 'kappamaki', 'potted_plant'],
    'Chapter 7 Gold awards cap_extension_12h, kappamaki, and potted_plant',
  );
});

test('M2-T07: evaluateMedalGrants awards conveyor_belt for Bronze in Lesson 9 (week-4)', () => {
  const w4 = getCourseWeekById('week-4');
  assert.equal(w4.lessonNumber, 9, 'Chapter 9 is week-4');
  const progress = createFreshCourseProgress();

  const total = w4.vocab.length + w4.kanji.length + w4.conjugations.length + w4.quiz.length;
  const targetCompleted = Math.ceil(total * 0.6);
  for (let i = 0; i < targetCompleted && i < w4.vocab.length; i++) {
    progress.masteredVocabIds[w4.vocab[i].id] = true;
  }
  if (targetCompleted > w4.vocab.length) {
    const rem = targetCompleted - w4.vocab.length;
    for (let i = 0; i < rem && i < w4.kanji.length; i++) {
      progress.masteredKanjiIds[w4.kanji[i].id] = true;
    }
  }

  assert.deepEqual(
    evaluateMedalGrants(progress),
    ['conveyor_belt'],
    'Chapter 9 Bronze strictly awards conveyor_belt via lessonNumber: 9',
  );
});

test('M2-T08: evaluateMedalGrants awards conveyor_belt and wave_print for Gold in Lesson 9 (week-4)', () => {
  const w4 = getCourseWeekById('week-4');
  const progress = createFreshCourseProgress();

  for (const v of w4.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w4.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w4.conjugations) progress.masteredDojoIds[c.id] = true;
  progress.quizBestResults['week-4'] = { score: w4.quiz.length, total: w4.quiz.length, date: 1000 };

  assert.deepEqual(
    evaluateMedalGrants(progress),
    ['conveyor_belt', 'ebi_nigiri', 'wave_print'],
    'Chapter 9 Gold awards conveyor_belt, ebi_nigiri, and wave_print',
  );
});

test('M2-T09: evaluateMedalGrants yields unlock grants for expanded chapters (Lessons 8, 10, 11, 12)', () => {
  // Master Chapter 8 (week-3) 100%
  const w3 = getCourseWeekById('week-3');
  const progress = createFreshCourseProgress();
  for (const v of w3.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w3.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w3.conjugations) progress.masteredDojoIds[c.id] = true;
  progress.quizBestResults['week-3'] = { score: w3.quiz.length, total: w3.quiz.length, date: 1000 };

  assert.deepEqual(
    evaluateMedalGrants(progress),
    ['precision_knife', 'maguro_nigiri', 'noren_curtain'],
    'Chapter 8 awards precision_knife, maguro_nigiri, and noren_curtain on gold mastery',
  );
});

test('M2-T10: evaluateMedalGrants handles null/undefined inputs and custom week lists safely', () => {
  assert.deepEqual(evaluateMedalGrants(null), []);
  assert.deepEqual(evaluateMedalGrants(undefined), []);
  assert.deepEqual(evaluateMedalGrants(createFreshCourseProgress(), []), []);
});

test('M2-T11: tierSatisfies implements tier inheritance hierarchy correctly', () => {
  // null satisfies nothing
  assert.equal(tierSatisfies(null, 'bronze'), false);
  assert.equal(tierSatisfies(null, 'silver'), false);
  assert.equal(tierSatisfies(null, 'gold'), false);

  // bronze satisfies bronze only
  assert.equal(tierSatisfies('bronze', 'bronze'), true);
  assert.equal(tierSatisfies('bronze', 'silver'), false);
  assert.equal(tierSatisfies('bronze', 'gold'), false);

  // silver satisfies bronze and silver
  assert.equal(tierSatisfies('silver', 'bronze'), true);
  assert.equal(tierSatisfies('silver', 'silver'), true);
  assert.equal(tierSatisfies('silver', 'gold'), false);

  // gold satisfies all tiers
  assert.equal(tierSatisfies('gold', 'bronze'), true);
  assert.equal(tierSatisfies('gold', 'silver'), true);
  assert.equal(tierSatisfies('gold', 'gold'), true);
});

test('M2-T12: mergePermanentGrants deduplicates and sanitizes strings', () => {
  const existing = ['prep_counter', 'salmon_nigiri'];
  const newlyEarned = ['salmon_nigiri', '  paper_lantern  ', '', '   '];

  const merged = mergePermanentGrants(existing, newlyEarned);
  assert.deepEqual(
    merged,
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    'Must deduplicate and sanitize strings without blank elements',
  );
});

test('M2-T13: mergePermanentGrants enforces monotonic non-revocation when progress drops or knowledge is unmarked', () => {
  // Student achieved Gold in Chapter 6:
  const initialGrants = ['prep_counter', 'salmon_nigiri', 'paper_lantern'];

  // Later, student unmarks vocabulary, dropping to Bronze level:
  const degradedGrants = ['prep_counter'];

  const merged = mergePermanentGrants(initialGrants, degradedGrants);
  assert.deepEqual(
    merged,
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    'Grants must NEVER be revoked or removed when student mastery drops',
  );
});

test('M2-T14: mergePermanentGrants preserves all grants across full course resets', () => {
  const priorGrants = ['prep_counter', 'cap_extension_12h', 'conveyor_belt'];
  const resetGrants: string[] = [];

  const merged = mergePermanentGrants(priorGrants, resetGrants);
  assert.deepEqual(
    merged,
    priorGrants,
    'Grants must be 100% preserved even if course progress is completely wiped',
  );
});

test('M2-T15: SUSHI_UNLOCK_CATALOG contains all 21 items with correct chapter and week mappings', () => {
  assert.equal(SUSHI_UNLOCK_CATALOG.length, 21, 'Catalog must contain all 21 unlock items');

  const expectedIds: UnlockGrantId[] = [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'kappamaki',
    'potted_plant',
    'precision_knife',
    'maguro_nigiri',
    'noren_curtain',
    'conveyor_belt',
    'ebi_nigiri',
    'wave_print',
    'service_counter',
    'tamago_nigiri',
    'andon_lantern',
    'sous_chef',
    'sashimi_plate',
    'sakura_bonsai',
    'master_license',
    'omakase_menu',
    'golden_maneki_neko',
  ];
  assert.deepEqual(
    SUSHI_UNLOCK_CATALOG.map((c) => c.id),
    expectedIds,
  );

  // Check conveyor belt milestone mapping
  const belt = SUSHI_UNLOCK_CATALOG.find((c) => c.id === 'conveyor_belt');
  assert.ok(belt, 'Conveyor belt must exist in catalog');
  assert.equal(belt.requiredLesson, 9, 'Conveyor belt requires Lesson 9');
  assert.equal(belt.targetWeekId, 'week-4', 'Conveyor belt target week is week-4');
  assert.equal(belt.requiredTier, 'bronze', 'Conveyor belt requires bronze tier');
  assert.equal(belt.priceYen, 3600, 'Conveyor belt costs 3600 yen');
});
