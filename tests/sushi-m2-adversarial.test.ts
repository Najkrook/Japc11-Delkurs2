/**
 * Empirical Adversarial Test Suite for Milestone 2: Non-Revocation & Edge Cases
 * Author: Teamwork Challenger (critic, specialist)
 * Target: src/course/sushi-game/medals.ts, src/course/sushi-game/service.ts
 */

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
import {
  SushiService,
  InMemorySushiRepository,
  type SushiStorageLike,
  sushiStorageKey,
} from '../src/course/sushi-game/service.ts';
import type { SushiRestaurantState } from '../src/course/sushi-game/types.ts';

// Helper to calculate total items for a week
function getWeekTotalItems(week: CourseWeek): number {
  return week.vocab.length + week.kanji.length + week.conjugations.length + week.quiz.length;
}

// Helper to set progress ratio on a week
function setWeekMasteryRatio(
  progress: CourseProgressData,
  week: CourseWeek,
  ratio: number,
): void {
  const total = getWeekTotalItems(week);
  const target = Math.min(total, Math.ceil(total * ratio));
  let count = 0;

  for (const v of week.vocab) {
    if (count >= target) break;
    progress.masteredVocabIds[v.id] = true;
    count++;
  }
  for (const k of week.kanji) {
    if (count >= target) break;
    progress.masteredKanjiIds[k.id] = true;
    count++;
  }
  for (const c of week.conjugations) {
    if (count >= target) break;
    progress.masteredDojoIds[c.id] = true;
    count++;
  }
  if (count < target && week.quiz.length > 0) {
    const quizNeeded = Math.min(week.quiz.length, target - count);
    progress.quizBestResults[week.id] = {
      score: quizNeeded,
      total: week.quiz.length,
      date: Date.now(),
    };
  }
}

// Helper to clear mastery for a week
function clearWeekMastery(progress: CourseProgressData, week: CourseWeek): void {
  for (const v of week.vocab) {
    delete progress.masteredVocabIds[v.id];
  }
  for (const k of week.kanji) {
    delete progress.masteredKanjiIds[k.id];
  }
  for (const c of week.conjugations) {
    delete progress.masteredDojoIds[c.id];
  }
  delete progress.quizBestResults[week.id];
}

// ---------------------------------------------------------------------------
// 1. Empirical Verification: Student Lifecycle & Severe Mastery Drop Non-Revocation
// ---------------------------------------------------------------------------

test('Adversarial M2-01: Student earns Chapters 6, 7, 9 medals, then suffers 100% severe mastery drop', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'adversarial-student-01';
  let nowMs = 1_700_000_000_000;

  const w1 = getCourseWeekById('week-1'); // Chapter 6
  const w2 = getCourseWeekById('week-2'); // Chapter 7
  const w4 = getCourseWeekById('week-4'); // Chapter 9

  const courseProgress = createFreshCourseProgress();

  // Phase 1: Student starts fresh -> restaurant initialized with 0 grants
  const r0 = await service.getOrInitRestaurant(uid, nowMs, evaluateMedalGrants(courseProgress));
  assert.equal(r0.id, uid);
  assert.deepEqual(r0.permanentGrants, []);

  // Phase 2: Earn Chapter 6 Bronze (60%) -> prep_counter
  setWeekMasteryRatio(courseProgress, w1, 0.6);
  let evaluated = evaluateMedalGrants(courseProgress);
  assert.deepEqual(evaluated, ['prep_counter']);
  let rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));
  assert.deepEqual(rState.permanentGrants, ['prep_counter']);

  // Phase 3: Earn Chapter 6 Silver (80%) -> prep_counter, salmon_nigiri
  setWeekMasteryRatio(courseProgress, w1, 0.8);
  evaluated = evaluateMedalGrants(courseProgress);
  assert.deepEqual(evaluated, ['prep_counter', 'salmon_nigiri']);
  rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));
  assert.deepEqual(rState.permanentGrants, ['prep_counter', 'salmon_nigiri']);

  // Phase 4: Earn Chapter 6 Gold (100%) -> prep_counter, salmon_nigiri, paper_lantern
  setWeekMasteryRatio(courseProgress, w1, 1.0);
  evaluated = evaluateMedalGrants(courseProgress);
  assert.deepEqual(evaluated, ['prep_counter', 'salmon_nigiri', 'paper_lantern']);
  rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));
  assert.deepEqual(rState.permanentGrants, [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
  ]);

  // Phase 5: Earn Chapter 7 Bronze (60%) -> cap_extension_12h
  setWeekMasteryRatio(courseProgress, w2, 0.6);
  evaluated = evaluateMedalGrants(courseProgress);
  assert.ok(evaluated.includes('cap_extension_12h'));
  rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));
  assert.deepEqual(rState.permanentGrants, [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
  ]);

  // Phase 6: Earn Chapter 7 Gold (100%) -> potted_plant
  setWeekMasteryRatio(courseProgress, w2, 1.0);
  evaluated = evaluateMedalGrants(courseProgress);
  assert.ok(evaluated.includes('potted_plant'));
  rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));
  assert.deepEqual(rState.permanentGrants, [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'potted_plant',
  ]);

  // Phase 7: Earn Chapter 9 Bronze (60%) -> conveyor_belt (milestone)
  setWeekMasteryRatio(courseProgress, w4, 0.6);
  evaluated = evaluateMedalGrants(courseProgress);
  assert.ok(evaluated.includes('conveyor_belt'));
  rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));
  assert.deepEqual(rState.permanentGrants, [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'potted_plant',
    'conveyor_belt',
  ]);

  // Phase 8: Earn Chapter 9 Gold (100%) -> wave_print (All 7 MVP unlock items earned!)
  setWeekMasteryRatio(courseProgress, w4, 1.0);
  evaluated = evaluateMedalGrants(courseProgress);
  assert.equal(evaluated.length, 7);
  rState = await service.syncMedalGrants(uid, evaluated, (nowMs += 1000));

  const all7Grants = [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'potted_plant',
    'conveyor_belt',
    'wave_print',
  ];
  assert.deepEqual(rState.permanentGrants, all7Grants);

  // -------------------------------------------------------------------------
  // SEVERE MASTERY DROP VERIFICATION
  // -------------------------------------------------------------------------

  // Drop 1: Student completely unmarks Chapter 6 items (mastery dropped to 0% in Ch 6)
  clearWeekMastery(courseProgress, w1);
  const ch6DroppedGrants = evaluateMedalGrants(courseProgress);
  assert.equal(ch6DroppedGrants.includes('prep_counter'), false);
  assert.equal(ch6DroppedGrants.includes('salmon_nigiri'), false);
  assert.equal(ch6DroppedGrants.includes('paper_lantern'), false);
  assert.equal(ch6DroppedGrants.length, 4); // Only Ch 7 and 9 remain

  // Sync with diminished grants
  rState = await service.syncMedalGrants(uid, ch6DroppedGrants, (nowMs += 1000));
  assert.deepEqual(
    rState.permanentGrants,
    all7Grants,
    'Drop 1: Restaurant permanentGrants must retain all 7 grants even after Ch 6 progress is wiped',
  );

  // Drop 2: Student unmarks Chapter 7 items (mastery dropped to 0% in Ch 7)
  clearWeekMastery(courseProgress, w2);
  const ch7DroppedGrants = evaluateMedalGrants(courseProgress);
  assert.equal(ch7DroppedGrants.includes('cap_extension_12h'), false);
  assert.equal(ch7DroppedGrants.includes('potted_plant'), false);
  assert.equal(ch7DroppedGrants.length, 2); // Only Ch 9 remains

  rState = await service.syncMedalGrants(uid, ch7DroppedGrants, (nowMs += 1000));
  assert.deepEqual(
    rState.permanentGrants,
    all7Grants,
    'Drop 2: Restaurant permanentGrants must retain all 7 grants after Ch 7 progress is wiped',
  );

  // Drop 3: Student unmarks Chapter 9 items (mastery dropped to 0% in Ch 9)
  clearWeekMastery(courseProgress, w4);
  const allWipedGrants = evaluateMedalGrants(courseProgress);
  assert.deepEqual(allWipedGrants, [], 'Evaluated grants are now strictly empty');

  rState = await service.syncMedalGrants(uid, allWipedGrants, (nowMs += 1000));
  assert.deepEqual(
    rState.permanentGrants,
    all7Grants,
    'Drop 3: Restaurant permanentGrants must retain 100% of earned grants when evaluated grants are empty array',
  );

  // Drop 4: Full course progress wipe/reset via createFreshCourseProgress()
  const resetProgress = createFreshCourseProgress();
  const resetGrants = evaluateMedalGrants(resetProgress);
  assert.deepEqual(resetGrants, []);

  rState = await service.syncMedalGrants(uid, resetGrants, (nowMs += 1000));
  assert.deepEqual(
    rState.permanentGrants,
    all7Grants,
    'Drop 4: Restaurant permanentGrants retains 100% after full course reset',
  );

  // Drop 5: Reopening restaurant with getOrInitRestaurant passing empty grants
  const reopened = await service.getOrInitRestaurant(uid, (nowMs += 1000), []);
  assert.deepEqual(
    reopened.permanentGrants,
    all7Grants,
    'Drop 5: getOrInitRestaurant preserves all grants when reopened with []',
  );

  // Drop 6: Reopening restaurant with getOrInitRestaurant without initialGrants parameter
  const reopenedNoParam = await service.getOrInitRestaurant(uid, (nowMs += 1000));
  assert.deepEqual(
    reopenedNoParam.permanentGrants,
    all7Grants,
    'Drop 6: getOrInitRestaurant preserves all grants when reopened without initialGrants',
  );

  // Drop 7: Persistence round-trip across new repository instance (browser F5 reload)
  const repo2 = new InMemorySushiRepository();
  // Transfer stored restaurant state into repo2 to simulate restart
  const stored = await repo.get(uid);
  assert.ok(stored);
  await repo2.set(stored);
  const service2 = new SushiService(repo2);

  const restored = await service2.getOrInitRestaurant(uid, (nowMs += 1000), []);
  assert.deepEqual(
    restored.permanentGrants,
    all7Grants,
    'Drop 7: Fresh service instance retains 100% of permanentGrants',
  );
});

// ---------------------------------------------------------------------------
// 2. Edge Cases in evaluateMedalGrants
// ---------------------------------------------------------------------------

test('Adversarial M2-02: evaluateMedalGrants boundary inputs (null, undefined, fresh progress)', () => {
  // Null / undefined inputs
  assert.deepEqual(evaluateMedalGrants(null), [], 'null courseState yields []');
  assert.deepEqual(evaluateMedalGrants(undefined), [], 'undefined courseState yields []');
  assert.deepEqual(evaluateMedalGrants(createFreshCourseProgress(), []), [], 'empty weeks yields []');
  assert.deepEqual(
    evaluateMedalGrants(createFreshCourseProgress(), null as any),
    [],
    'null weeks yields []',
  );
  assert.deepEqual(
    evaluateMedalGrants(createFreshCourseProgress(), undefined as any),
    [],
    'undefined weeks yields []',
  );
});

test('Adversarial M2-03: evaluateMedalGrants on empty/partial courseState objects', () => {
  // Case A: Fresh course progress created via factory
  const freshProgress = createFreshCourseProgress();
  assert.deepEqual(evaluateMedalGrants(freshProgress), []);

  // Case B: Partial courseState with empty dictionaries
  const partialValid: CourseProgressData = {
    activeWeekId: 'week-1',
    activeSubView: 'hub',
    masteredVocabIds: {},
    masteredKanjiIds: {},
    masteredDojoIds: {},
    quizBestResults: {},
    mistakeVocabIds: {},
    mistakeDojoIds: {},
    updatedAt: 0,
  };
  assert.deepEqual(evaluateMedalGrants(partialValid), []);

  // Case C: Uninitialized / empty JS object {} (Empirical investigation of crash resilience)
  // When an untyped or corrupted courseState object {} is passed, does it throw or handle gracefully?
  try {
    const res = evaluateMedalGrants({} as any);
    // If it did not throw, it must return []
    assert.deepEqual(res, []);
  } catch (err: any) {
    // If it threw, verify the exact error behavior and record empirical finding
    assert.ok(
      err instanceof TypeError,
      `Uninitialized {} triggers TypeError: ${err?.message}`,
    );
  }
});

test('Adversarial M2-04: evaluateMedalGrants with zero total items in week curriculum', () => {
  // A hypothetical week with zero total items (empty vocab, kanji, conjugations, quiz)
  const zeroWeek: CourseWeek = {
    id: 'week-zero',
    title: 'Noll lektion',
    subtitle: '',
    description: '',
    lessonNumber: 6,
    vocab: [],
    kanji: [],
    conjugations: [],
    quiz: [],
  };

  const progress = createFreshCourseProgress();
  const grants = evaluateMedalGrants(progress, [zeroWeek]);
  assert.deepEqual(grants, [], 'Zero total items must award 0 medals and return []');

  // Verify getWeekProgressSummary directly with zero total items
  const summary = getWeekProgressSummary(progress, zeroWeek);
  assert.equal(summary.overallPercent, 0);
  assert.equal(summary.medal, null);
  assert.equal(summary.nextThresholdPercent, 60);
});

test('Adversarial M2-05: evaluateMedalGrants with corrupted week IDs and mismatched weeks', () => {
  const progress = createFreshCourseProgress();
  const w1 = getCourseWeekById('week-1');

  // Master week 1 to 100%
  for (const v of w1.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w1.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w1.conjugations) progress.masteredDojoIds[c.id] = true;
  progress.quizBestResults['week-1'] = { score: w1.quiz.length, total: w1.quiz.length, date: 1000 };

  // Subtest 1: Week with corrupted non-standard ID
  const corruptedIdWeek: CourseWeek = {
    ...w1,
    id: 'corrupted-nonexistent-id-###',
  };
  // Since quizBestResults is indexed by week.id ('week-1'), the corrupted week won't match quizBestResults
  // but vocab, kanji, dojo will match because their item IDs match!
  const grantsCorruptedId = evaluateMedalGrants(progress, [corruptedIdWeek]);
  // Total non-quiz items is 89 / 102 = 87.25% (Silver)
  assert.deepEqual(
    grantsCorruptedId,
    ['prep_counter', 'salmon_nigiri'],
    'Corrupted week.id safely misses quiz results but retains study mastery',
  );

  // Subtest 2: Week with empty string ID
  const emptyIdWeek: CourseWeek = {
    ...w1,
    id: '',
  };
  const grantsEmptyId = evaluateMedalGrants(progress, [emptyIdWeek]);
  assert.deepEqual(grantsEmptyId, ['prep_counter', 'salmon_nigiri']);

  // Subtest 3: Week with missing or invalid lessonNumber (undefined, NaN, negative)
  const invalidLessonWeeks = [
    { ...w1, lessonNumber: undefined as any },
    { ...w1, lessonNumber: NaN },
    { ...w1, lessonNumber: -99 },
    { ...w1, lessonNumber: 9999 },
    null as any,
    undefined as any,
  ];
  const grantsInvalidLessons = evaluateMedalGrants(progress, invalidLessonWeeks);
  assert.deepEqual(
    grantsInvalidLessons,
    [],
    'Invalid lessonNumbers or null weeks in array must be safely ignored without throwing',
  );

  // Subtest 4: Week ID misaligned with lessonNumber (e.g. week.id === 'week-9' with lessonNumber: 9)
  // Genki Lesson 9 is week-4 in the course, but what if someone passes a week with id 'week-9' and lessonNumber 9?
  const w4 = getCourseWeekById('week-4');
  const customWeek9: CourseWeek = {
    ...w4,
    id: 'week-9',
    lessonNumber: 9,
  };
  // Progress recorded on 'week-9' quiz
  progress.quizBestResults['week-9'] = { score: w4.quiz.length, total: w4.quiz.length, date: 1000 };
  for (const v of w4.vocab) progress.masteredVocabIds[v.id] = true;
  for (const k of w4.kanji) progress.masteredKanjiIds[k.id] = true;
  for (const c of w4.conjugations) progress.masteredDojoIds[c.id] = true;

  const grantsLesson9 = evaluateMedalGrants(progress, [customWeek9]);
  assert.deepEqual(
    grantsLesson9,
    ['conveyor_belt', 'wave_print'],
    'Lesson 9 strictly maps by lessonNumber: 9 regardless of whether week.id is week-4 or week-9',
  );
});

// ---------------------------------------------------------------------------
// 3. Adversarial mergePermanentGrants: Sanitization, Pollution & Edge Cases
// ---------------------------------------------------------------------------

test('Adversarial M2-06: mergePermanentGrants handles non-array, prototype pollution, and malformed entries', () => {
  // Non-array inputs
  assert.deepEqual(mergePermanentGrants(null as any, null as any), []);
  assert.deepEqual(mergePermanentGrants(undefined as any, undefined as any), []);
  assert.deepEqual(mergePermanentGrants('string' as any, 123 as any), []);
  assert.deepEqual(mergePermanentGrants({} as any, [] as any), []);

  // Prototype pollution keys
  const maliciousGrants = ['__proto__', 'constructor', 'toString', 'valueOf', 'prep_counter'];
  const merged = mergePermanentGrants([], maliciousGrants);

  // Must contain string values without polluting Object prototype
  assert.ok(merged.includes('prep_counter'));
  assert.ok(merged.includes('__proto__'));
  assert.ok(merged.includes('constructor'));
  assert.equal(Object.prototype.hasOwnProperty('polluted'), false);

  // Whitespace and non-string elements inside array
  const dirtyGrants = [
    null as any,
    undefined as any,
    123 as any,
    true as any,
    '',
    '   ',
    '\t\n',
    '  prep_counter  ',
    'salmon_nigiri',
    'prep_counter',
  ];
  const cleaned = mergePermanentGrants(['prep_counter'], dirtyGrants);
  assert.deepEqual(
    cleaned.sort(),
    ['prep_counter', 'salmon_nigiri'].sort(),
    'Non-strings, empty strings, and surrounding whitespace must be sanitized and deduplicated',
  );
});

// ---------------------------------------------------------------------------
// 4. Concurrency & Monotonicity Invariant Stress Test
// ---------------------------------------------------------------------------

test('Adversarial M2-07: 50 concurrent syncMedalGrants with randomized grant sets preserve monotonicity', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'stress-concurrent-student';
  const nowMs = 1_700_000_000_000;

  await service.getOrInitRestaurant(uid, nowMs, ['prep_counter']);

  const allPossibleGrants: UnlockGrantId[] = [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'potted_plant',
    'conveyor_belt',
    'wave_print',
  ];

  // Run 50 concurrent sync operations with random subsets (including empty arrays to simulate drops)
  const promises: Promise<SushiRestaurantState>[] = [];
  for (let i = 0; i < 50; i++) {
    const randomCount = Math.floor(Math.random() * (allPossibleGrants.length + 1));
    const randomGrants = allPossibleGrants.slice(0, randomCount);
    // Shuffle
    randomGrants.sort(() => Math.random() - 0.5);

    promises.push(
      service.syncMedalGrants(uid, randomGrants, nowMs + (i + 1) * 10),
    );
  }

  await Promise.all(promises);

  const final = await service.getOrInitRestaurant(uid, nowMs + 10_000);

  // Initial grant prep_counter must never be lost
  assert.ok(
    final.permanentGrants.includes('prep_counter'),
    'Initial grant prep_counter must be present after 50 concurrent operations',
  );

  // Deduplication check: every grant in permanentGrants must be unique
  const set = new Set(final.permanentGrants);
  assert.equal(
    set.size,
    final.permanentGrants.length,
    'Grants must have zero duplicates after concurrent sync',
  );

  // All grants in permanentGrants must be valid catalog IDs
  for (const g of final.permanentGrants) {
    assert.ok(
      allPossibleGrants.includes(g as UnlockGrantId),
      `Unknown grant ID found: ${g}`,
    );
  }
});

test('Adversarial M2-08: Monotonic non-revocation invariant fuzzer (100 random state transitions)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'fuzz-student';
  let nowMs = 1_000_000;

  let currentRestaurant = await service.getOrInitRestaurant(uid, nowMs);
  let priorGrantSet = new Set(currentRestaurant.permanentGrants);

  const grantPool: UnlockGrantId[] = [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'potted_plant',
    'conveyor_belt',
    'wave_print',
  ];

  for (let step = 0; step < 100; step++) {
    nowMs += 100;
    // 30% chance of empty array (full reset / drop), 70% chance of random grants
    const isWipe = Math.random() < 0.3;
    const inputGrants: string[] = isWipe
      ? []
      : grantPool.filter(() => Math.random() > 0.5);

    currentRestaurant = await service.syncMedalGrants(uid, inputGrants, nowMs);

    const newGrantSet = new Set(currentRestaurant.permanentGrants);

    // Invariant 1: priorGrantSet ⊆ newGrantSet (No grant is ever revoked)
    for (const priorGrant of priorGrantSet) {
      assert.ok(
        newGrantSet.has(priorGrant),
        `INVARIANT VIOLATION at step ${step}: Grant '${priorGrant}' was revoked after syncing with [${inputGrants.join(', ')}]`,
      );
    }

    // Invariant 2: Set size is monotonically non-decreasing
    assert.ok(
      newGrantSet.size >= priorGrantSet.size,
      `INVARIANT VIOLATION: Grant count decreased from ${priorGrantSet.size} to ${newGrantSet.size}`,
    );

    priorGrantSet = newGrantSet;
  }

  assert.ok(true, '100 random transitions strictly preserved non-revocation invariant');
});
