import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProductionRate,
  calculateAccrual,
  collectEarnings,
  unitsToWholeYen,
  unitsToYenDecimal,
  yenToUnits,
  canAfford,
  createInitialEconomyState,
} from '../src/course/sushi-game/economy.ts';
import {
  YEN_UNIT_MULTIPLIER,
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from '../src/course/sushi-game/types.ts';
import {
  SUSHI_CATALOG,
  previewUpgradeImpact,
  getCatalogItem,
} from '../src/course/sushi-game/catalog.ts';
import {
  evaluateMedalGrants,
  tierSatisfies,
  mergePermanentGrants,
  MEDAL_GRANT_RULES,
} from '../src/course/sushi-game/medals.ts';
import type { CourseProgressData, CourseWeek } from '../src/course/types.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';

// =============================================================================
// Tier 1: Feature Coverage — Two-Capacity Production Formula & Bottlenecks
// =============================================================================

test('Tier 1 [F01]: calculateProductionRate computes O = min(K, S) and R = O * A across combinations', () => {
  // Scenario 1: Base restaurant (Kitchen 1, Service 2, AvgRev 10)
  // Expected: O = min(1, 2) = 1; R = 1 * 10 = 10; bottleneck = 'kitchen'
  const base = calculateProductionRate(1, 2, 10);
  assert.equal(base.ordersPerMinute, 1);
  assert.equal(base.yenPerMinute, 10);
  assert.equal(base.bottleneck, 'kitchen');

  // Scenario 2: Upgraded kitchen (Kitchen 3, Service 2, AvgRev 10)
  // Expected: O = min(3, 2) = 2; R = 2 * 10 = 20; bottleneck = 'service'
  const serviceLimited = calculateProductionRate(3, 2, 10);
  assert.equal(serviceLimited.ordersPerMinute, 2);
  assert.equal(serviceLimited.yenPerMinute, 20);
  assert.equal(serviceLimited.bottleneck, 'service');

  // Scenario 3: Perfectly balanced capacities (Kitchen 4, Service 4, AvgRev 10)
  // Expected: O = min(4, 4) = 4; R = 4 * 10 = 40; bottleneck = 'none'
  const balanced = calculateProductionRate(4, 4, 10);
  assert.equal(balanced.ordersPerMinute, 4);
  assert.equal(balanced.yenPerMinute, 40);
  assert.equal(balanced.bottleneck, 'none');

  // Scenario 4: Higher average revenue per order (Kitchen 2, Service 3, AvgRev 15)
  // Expected: O = min(2, 3) = 2; R = 2 * 15 = 30; bottleneck = 'kitchen'
  const higherRev = calculateProductionRate(2, 3, 15);
  assert.equal(higherRev.ordersPerMinute, 2);
  assert.equal(higherRev.yenPerMinute, 30);
  assert.equal(higherRev.bottleneck, 'kitchen');

  // Scenario 5: Zero capacities clamp safely to 0
  const zeroCap = calculateProductionRate(0, 5, 10);
  assert.equal(zeroCap.ordersPerMinute, 0);
  assert.equal(zeroCap.yenPerMinute, 0);
  assert.equal(zeroCap.bottleneck, 'kitchen');
});

// =============================================================================
// Tier 1: Feature Coverage — Exact 1/60,000 Yen Currency Mathematics
// =============================================================================

test('Tier 1 [F02]: Currency conversion functions maintain lossless 1/60,000 integer units', () => {
  // Constant verification: 1 Yen = exactly 60,000 internal units
  assert.equal(YEN_UNIT_MULTIPLIER, 60_000);

  // yenToUnits: Whole yen to units
  assert.equal(yenToUnits(1), 60_000);
  assert.equal(yenToUnits(10), 600_000);
  assert.equal(yenToUnits(300), 18_000_000);
  assert.equal(yenToUnits(0), 0);

  // unitsToWholeYen: Floor rounding for whole yen
  assert.equal(unitsToWholeYen(0), 0);
  assert.equal(unitsToWholeYen(59_999), 0);
  assert.equal(unitsToWholeYen(60_000), 1);
  assert.equal(unitsToWholeYen(60_001), 1);
  assert.equal(unitsToWholeYen(119_999), 1);
  assert.equal(unitsToWholeYen(120_000), 2);
  assert.equal(unitsToWholeYen(18_000_000), 300);

  // unitsToYenDecimal: Exact fractional values
  assert.equal(unitsToYenDecimal(30_000), 0.5);
  assert.equal(unitsToYenDecimal(15_000), 0.25);
  assert.equal(unitsToYenDecimal(60_000), 1.0);

  // canAfford: Validation of spendable balance
  assert.equal(canAfford(600_000, 10), true);
  assert.equal(canAfford(599_999, 10), false);
  assert.equal(canAfford(600_001, 10), true);
});

// =============================================================================
// Tier 1: Feature Coverage — Lazy Offline Accrual & Invariance
// =============================================================================

test('Tier 1 [F03]: calculateAccrual computes deterministic income without background ticking', () => {
  const t0 = 1_000_000;
  const state = createInitialEconomyState(t0);

  // 15 minutes elapsed at base rate (10 yen/min)
  // Expected earned units = 15 * 60,000 * 10 = 9,000,000 units (150 yen)
  const t15m = t0 + 15 * MS_PER_MINUTE;
  const accrual = calculateAccrual(state, t15m);

  assert.equal(accrual.elapsedMs, 15 * MS_PER_MINUTE);
  assert.equal(accrual.producedMs, 15 * MS_PER_MINUTE);
  assert.equal(accrual.excessMs, 0);
  assert.equal(accrual.isCapped, false);
  assert.equal(accrual.earnedUnits, 9_000_000);
  assert.equal(unitsToWholeYen(accrual.earnedUnits), 150);
  assert.equal(accrual.updatedState.uncollectedUnits, 9_000_000);
  assert.equal(accrual.updatedState.accountedAtMs, t15m);
  assert.equal(accrual.updatedState.usedProductionMs, 15 * MS_PER_MINUTE);
});

test('Tier 1 [F03]: Accrual interval-splitting invariance: accrue(t1) + accrue(t2) === accrue(t1 + t2)', () => {
  const t0 = 5_000_000;
  const stateInitial = createInitialEconomyState(t0);

  // Method A: Single 30-minute accrual
  const t30m = t0 + 30 * MS_PER_MINUTE;
  const singleStepResult = calculateAccrual(stateInitial, t30m);

  // Method B: Two consecutive 15-minute accruals
  const t15m = t0 + 15 * MS_PER_MINUTE;
  const step1 = calculateAccrual(stateInitial, t15m);
  const step2 = calculateAccrual(step1.updatedState, t30m);

  // Verifying perfect identity
  assert.equal(step2.updatedState.uncollectedUnits, singleStepResult.updatedState.uncollectedUnits);
  assert.equal(step2.updatedState.usedProductionMs, singleStepResult.updatedState.usedProductionMs);
  assert.equal(step2.updatedState.accountedAtMs, singleStepResult.updatedState.accountedAtMs);
  assert.equal(
    unitsToWholeYen(step2.updatedState.uncollectedUnits),
    unitsToWholeYen(singleStepResult.updatedState.uncollectedUnits),
  );
});

// =============================================================================
// Tier 1: Feature Coverage — Manual Revenue Collection ("Hämta intäkter")
// =============================================================================

test('Tier 1 [F05]: collectEarnings transfers uncollected register earnings to spendable wallet', () => {
  const t0 = 10_000_000;
  const state = createInitialEconomyState(t0);

  // 1 hour elapsed at 10 yen/min -> 600 yen (36,000,000 units)
  const t1h = t0 + MS_PER_HOUR;
  const collection = collectEarnings(state, t1h);

  assert.equal(collection.transferredUnits, 36_000_000);
  assert.equal(collection.transferredYenWhole, 600);
  assert.equal(collection.previousBalanceUnits, 0);
  assert.equal(collection.newBalanceUnits, 36_000_000);

  // State inspection after collection
  const finalState = collection.updatedState;
  assert.equal(finalState.balanceUnits, 36_000_000);
  assert.equal(finalState.uncollectedUnits, 0); // Reset to 0
  assert.equal(finalState.usedProductionMs, 0); // Reset used time
  assert.equal(finalState.accountedAtMs, t1h);
  assert.equal(finalState.periodStartMs, t1h);

  // Subsequent immediate collection yields 0 transferred units
  const secondCollection = collectEarnings(finalState, t1h);
  assert.equal(secondCollection.transferredUnits, 0);
  assert.equal(secondCollection.newBalanceUnits, 36_000_000);
});

// =============================================================================
// Tier 1: Feature Coverage — Master Catalog & Prospective Impact Previews
// =============================================================================

test('Tier 1 [F10]: Master catalog items define canonical requirements, prices, and effects', () => {
  assert.equal(SUSHI_CATALOG.length, 21);

  const prepCounter = getCatalogItem('prep_counter');
  assert.ok(prepCounter);
  assert.equal(prepCounter.id, 'prep_counter');
  assert.equal(prepCounter.requiredLesson, 6);
  assert.equal(prepCounter.requiredTier, 'bronze');
  assert.equal(prepCounter.priceYen, 300);
  assert.equal(prepCounter.priceUnits, 300 * 60_000);
  assert.equal(prepCounter.kitchenCapacityDelta, 2);

  const salmonNigiri = getCatalogItem('salmon_nigiri');
  assert.ok(salmonNigiri);
  assert.equal(salmonNigiri.id, 'salmon_nigiri');
  assert.equal(salmonNigiri.requiredLesson, 6);
  assert.equal(salmonNigiri.requiredTier, 'silver');
  assert.equal(salmonNigiri.priceYen, 600);
  assert.equal(salmonNigiri.category, 'recipe');

  const cap12h = getCatalogItem('cap_extension_12h');
  assert.ok(cap12h);
  assert.equal(cap12h.id, 'cap_extension_12h');
  assert.equal(cap12h.requiredLesson, 7);
  assert.equal(cap12h.requiredTier, 'bronze');
  assert.equal(cap12h.priceYen, 1800);
  assert.equal(cap12h.newCapMs, EXTENDED_CAP_MS);

  const conveyorBelt = getCatalogItem('conveyor_belt');
  assert.ok(conveyorBelt);
  assert.equal(conveyorBelt.id, 'conveyor_belt');
  assert.equal(conveyorBelt.requiredLesson, 9);
  assert.equal(conveyorBelt.requiredTier, 'bronze');
  assert.equal(conveyorBelt.priceYen, 3600);
  assert.equal(conveyorBelt.serviceCapacityDelta, 2);
});

test('Tier 1 [F10]: previewUpgradeImpact calculates rate deltas and bottleneck explanations', () => {
  const baseState = createInitialEconomyState(0); // K:1, S:2, AvgRev:10

  // 1. Upgrading kitchen (+2 kitchen) removes kitchen bottleneck and increases income directly
  const kitchenImpact = previewUpgradeImpact(baseState, { kitchenCapacityDelta: 2 });
  assert.equal(kitchenImpact.ordersDelta, 1); // 1 -> 2
  assert.equal(kitchenImpact.yenDelta, 10); // 10 -> 20 yen/min
  assert.equal(kitchenImpact.hasImmediateEffect, true);
  assert.equal(kitchenImpact.isBottleneckLimiting, false);
  assert.match(kitchenImpact.educationalExplanation, /ökar direkt från 10 till 20 ¥\/min/);

  // 2. Upgrading service (+2 service) while kitchen is bottleneck yields zero immediate revenue gain
  const serviceImpact = previewUpgradeImpact(baseState, { serviceCapacityDelta: 2 });
  assert.equal(serviceImpact.ordersDelta, 0); // Service 2 -> 4, but Kitchen is 1 -> min(1, 4) = 1
  assert.equal(serviceImpact.yenDelta, 0);
  assert.equal(serviceImpact.hasImmediateEffect, false);
  assert.equal(serviceImpact.isBottleneckLimiting, true);
  assert.match(serviceImpact.educationalExplanation, /ökar servicekapaciteten till 4 ordrar\/min/);
  assert.match(serviceImpact.educationalExplanation, /köket producerar bara 1 order\/min/);

  // 3. Cap extension preview
  const capImpact = previewUpgradeImpact(baseState, { newCapMs: EXTENDED_CAP_MS });
  assert.equal(capImpact.ordersDelta, 0);
  assert.equal(capImpact.yenDelta, 0);
  assert.equal(capImpact.hasImmediateEffect, true);
  assert.match(capImpact.educationalExplanation, /Förlänger produktionstiden med \+4 timmar/);
});

// =============================================================================
// Tier 1: Feature Coverage — Genki Curriculum Study Progress & Medal Grants
// =============================================================================

test('Tier 1 [F08]: tierSatisfies enforces hierarchical medal progression', () => {
  assert.equal(tierSatisfies('gold', 'bronze'), true);
  assert.equal(tierSatisfies('gold', 'silver'), true);
  assert.equal(tierSatisfies('gold', 'gold'), true);

  assert.equal(tierSatisfies('silver', 'bronze'), true);
  assert.equal(tierSatisfies('silver', 'silver'), true);
  assert.equal(tierSatisfies('silver', 'gold'), false);

  assert.equal(tierSatisfies('bronze', 'bronze'), true);
  assert.equal(tierSatisfies('bronze', 'silver'), false);
  assert.equal(tierSatisfies('bronze', 'gold'), false);

  assert.equal(tierSatisfies(null, 'bronze'), false);
  assert.equal(tierSatisfies(undefined, 'bronze'), false);
});

test('Tier 1 [F08]: evaluateMedalGrants accurately derives grants from student course progress', () => {
  // Empty progress yields no grants
  assert.deepEqual(evaluateMedalGrants(null, courseWeeks), []);
  assert.deepEqual(evaluateMedalGrants(createFreshCourseProgress(), courseWeeks), []);

  const w1 = courseWeeks.find((w) => w.id === 'week-1');
  assert.ok(w1);
  const progress = createFreshCourseProgress();

  // Complete 100% of week-1 (Lesson 6 Gold)
  for (const v of w1.vocab) {
    progress.masteredVocabIds[v.id] = true;
  }
  for (const k of w1.kanji) {
    progress.masteredKanjiIds[k.id] = true;
  }
  for (const c of w1.conjugations) {
    progress.masteredDojoIds[c.id] = true;
  }
  progress.quizBestResults['week-1'] = {
    score: w1.quiz.length,
    total: w1.quiz.length,
    date: Date.now(),
  };

  const grants = evaluateMedalGrants(progress, courseWeeks);
  assert.ok(grants.includes('prep_counter'));
  assert.ok(grants.includes('salmon_nigiri'));
  assert.ok(grants.includes('paper_lantern'));
  assert.equal(grants.includes('cap_extension_12h'), false); // Ch 7 not completed
});

test('Tier 1 [F08]: Chapter 9 correctly maps to week-4 by lessonNumber', () => {
  // Verify curriculum metadata: week-4 has lessonNumber = 9
  const week4 = courseWeeks.find((w) => w.id === 'week-4');
  assert.ok(week4);
  assert.equal(week4.lessonNumber, 9);

  const progress = createFreshCourseProgress();
  const totalItems =
    week4.vocab.length + week4.kanji.length + week4.conjugations.length + week4.quiz.length;
  const targetCompleted = Math.ceil(totalItems * 0.65); // 65% >= Bronze (60%), < Silver (80%)

  // Master vocabulary items up to target
  for (let i = 0; i < targetCompleted && i < week4.vocab.length; i++) {
    progress.masteredVocabIds[week4.vocab[i].id] = true;
  }
  if (targetCompleted > week4.vocab.length) {
    const rem = targetCompleted - week4.vocab.length;
    for (let i = 0; i < rem && i < week4.kanji.length; i++) {
      progress.masteredKanjiIds[week4.kanji[i].id] = true;
    }
  }

  const grants = evaluateMedalGrants(progress, courseWeeks);
  // Lesson 9 bronze gives conveyor_belt
  assert.ok(grants.includes('conveyor_belt'));
  // Wave print requires gold, so it shouldn't be granted with partial score
  assert.equal(grants.includes('wave_print'), false);
});
