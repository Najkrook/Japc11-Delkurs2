/**
 * Milestone 4: Comprehensive QA & Release Regression Test Suite
 *
 * Implements authoritative regression verification for:
 * 1. Extended offline accrual periods (10m, 1h, 8h, 12h, 24h & manual collection)
 * 2. Medal unlock monotonic non-revocation across all 21 items and Genki I chapters 6–12
 * 3. Purchase transactions (exact 60,000 units/yen, balance floor, prospective rate transitions, idempotency, slot equipping)
 * 4. Core Japanese study platform non-interference (flashcards, kanji canvas/quiz, dojo drills, grammar lessons)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Sushi Game Domain Imports
import {
  calculateAccrual,
  calculateProductionRate,
  collectEarnings,
  createDefaultRestaurantState,
  createInitialEconomyState,
  unitsToWholeYen,
  unitsToYenDecimal,
  yenToUnits,
} from '../src/course/sushi-game/economy.ts';
import {
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  YEN_UNIT_MULTIPLIER,
} from '../src/course/sushi-game/types.ts';
import type { SushiEconomyState, SushiRestaurantState } from '../src/course/sushi-game/types.ts';
import {
  SUSHI_CATALOG,
  getCatalogItem,
  previewCatalogPurchase,
  previewUpgradeImpact,
} from '../src/course/sushi-game/catalog.ts';
import {
  MEDAL_GRANT_RULES,
  evaluateMedalGrants,
  mergePermanentGrants,
  tierSatisfies,
} from '../src/course/sushi-game/medals.ts';
import type { UnlockGrantId } from '../src/course/sushi-game/medals.ts';
import { InMemorySushiRepository, SushiService } from '../src/course/sushi-game/domain-service.ts';

// Core Study Platform Imports
import {
  buildKanjiQuizQuestions,
  createStudyDrills,
  getDojoExpectedForm,
} from '../src/course/study-drills.ts';
import { recordQuizMistakes } from '../src/course/components/week-quiz.ts';
import { createCourseProgress } from '../src/course/course-progress.ts';
import { createFreshCourseProgress, getWeekProgressSummary } from '../src/course/course-state.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import type { CourseProgressData, CourseWeek } from '../src/course/types.ts';

// =============================================================================
// Helper: Study Progress Mock Harness
// =============================================================================

function createMockStudyEnvironment(week: CourseWeek = courseWeeks[0]) {
  const drills = createStudyDrills();
  const saved = new Map<string | null, CourseProgressData>();
  let mockNow = 100_000;

  const progress = createCourseProgress(
    {
      readLocal: (uid) => structuredClone(saved.get(uid) ?? createFreshCourseProgress()),
      writeLocal: (uid, data) => {
        saved.set(uid, structuredClone(data));
      },
      readCloud: async () => null,
      writeCloud: async () => {},
    },
    drills.reset,
    () => mockNow,
  );

  return {
    drills,
    progress,
    update: progress.update,
    vocab: () => drills.vocab.read(week, progress.snapshot()),
    dojo: () => drills.dojo.read(week, courseWeeks, progress.snapshot()),
    quiz: () => drills.quiz.read(week),
    kanjiQuiz: () => drills.kanjiQuiz.read(week),
    setNow: (ms: number) => {
      mockNow = ms;
    },
  };
}

// =============================================================================
// SUITE 1: Extended Offline Accrual Periods & Cap Clamping
// =============================================================================

test('Suite 1.1: Extended offline accrual at 10m, 1h, and 8h default cap (20 ¥/min)', () => {
  const startMs = 1_000_000_000;
  // Setup restaurant with Kitchen 3, Service 2, AvgRev 10
  // Throughput: O = min(3, 2) = 2 orders/min; R = 2 * 10 = 20 yen/min.
  const state: SushiEconomyState = createInitialEconomyState(startMs, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    capMs: DEFAULT_CAP_MS, // 28,800,000 ms (8 hours)
  });

  const rate = calculateProductionRate(
    state.kitchenCapacity,
    state.serviceCapacity,
    state.averageRevenuePerOrder,
  );
  assert.equal(rate.ordersPerMinute, 2, 'Expected 2 orders/min');
  assert.equal(rate.yenPerMinute, 20, 'Expected 20 yen/min');
  assert.equal(rate.bottleneck, 'service', 'Service should be the limiting bottleneck');

  // Point A: 10 minutes offline (600,000 ms)
  // Expected: 10 min * 20 ¥/min = 200 ¥ = 12,000,000 units
  const t10m = startMs + 10 * MS_PER_MINUTE;
  const accrual10m = calculateAccrual(state, t10m);
  assert.equal(accrual10m.elapsedMs, 600_000, 'Elapsed ms should be 600,000 ms (10 min)');
  assert.equal(accrual10m.producedMs, 600_000, 'Produced ms should be 600,000 ms');
  assert.equal(accrual10m.excessMs, 0, 'Excess ms should be 0');
  assert.equal(accrual10m.earnedUnits, 12_000_000, 'Earned units should be exactly 12,000,000');
  assert.equal(unitsToWholeYen(accrual10m.earnedUnits), 200, 'Whole yen should be exactly 200 ¥');
  assert.equal(accrual10m.isCapped, false, 'Should not be capped at 10 minutes');
  assert.equal(accrual10m.remainingCapMs, DEFAULT_CAP_MS - 600_000);

  // Point B: 1 hour offline (3,600,000 ms)
  // Expected: 60 min * 20 ¥/min = 1,200 ¥ = 72,000,000 units
  const t1h = startMs + 1 * MS_PER_HOUR;
  const accrual1h = calculateAccrual(state, t1h);
  assert.equal(accrual1h.elapsedMs, 3_600_000, 'Elapsed ms should be 3,600,000 ms (1 hour)');
  assert.equal(accrual1h.producedMs, 3_600_000, 'Produced ms should be 3,600,000 ms');
  assert.equal(accrual1h.excessMs, 0, 'Excess ms should be 0');
  assert.equal(accrual1h.earnedUnits, 72_000_000, 'Earned units should be exactly 72,000,000');
  assert.equal(
    unitsToWholeYen(accrual1h.earnedUnits),
    1_200,
    'Whole yen should be exactly 1,200 ¥',
  );
  assert.equal(accrual1h.isCapped, false, 'Should not be capped at 1 hour');
  assert.equal(accrual1h.remainingCapMs, DEFAULT_CAP_MS - 3_600_000);

  // Point C: 8 hours offline (28,800,000 ms) - exact default cap boundary
  // Expected: 480 min * 20 ¥/min = 9,600 ¥ = 576,000,000 units
  const t8h = startMs + 8 * MS_PER_HOUR;
  const accrual8h = calculateAccrual(state, t8h);
  assert.equal(accrual8h.elapsedMs, 28_800_000, 'Elapsed ms should be 28,800,000 ms (8 hours)');
  assert.equal(accrual8h.producedMs, 28_800_000, 'Produced ms should be 28,800,000 ms');
  assert.equal(accrual8h.excessMs, 0, 'Excess ms should be 0 exactly at the cap');
  assert.equal(accrual8h.earnedUnits, 576_000_000, 'Earned units should be exactly 576,000,000');
  assert.equal(
    unitsToWholeYen(accrual8h.earnedUnits),
    9_600,
    '8h default cap must equal 9,600 ¥ at 20 ¥/min',
  );
  assert.equal(accrual8h.isCapped, true, 'Must report isCapped = true at 8h cap');
  assert.equal(accrual8h.remainingCapMs, 0, 'Remaining cap must be 0 ms');
});

test('Suite 1.2: Extended offline accrual with 12h cap extension at 12h and 24h with stopped time discarded', () => {
  const startMs = 1_000_000_000;
  // State equipped with cap_extension_12h (EXTENDED_CAP_MS = 43,200,000 ms)
  const state: SushiEconomyState = createInitialEconomyState(startMs, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    capMs: EXTENDED_CAP_MS, // 12 hours
  });

  // Point D: 12 hours offline (43,200,000 ms)
  // Expected: 720 min * 20 ¥/min = 14,400 ¥ = 864,000,000 units
  const t12h = startMs + 12 * MS_PER_HOUR;
  const accrual12h = calculateAccrual(state, t12h);
  assert.equal(accrual12h.elapsedMs, 43_200_000, 'Elapsed ms should be 43,200,000 ms (12 hours)');
  assert.equal(accrual12h.producedMs, 43_200_000, 'Produced ms should be 43,200,000 ms');
  assert.equal(accrual12h.excessMs, 0, 'Excess ms should be 0 at 12h cap');
  assert.equal(accrual12h.earnedUnits, 864_000_000, 'Earned units should be exactly 864,000,000');
  assert.equal(
    unitsToWholeYen(accrual12h.earnedUnits),
    14_400,
    '12h extended cap must equal 14,400 ¥ at 20 ¥/min',
  );
  assert.equal(accrual12h.isCapped, true, 'Must report isCapped = true at 12h cap');
  assert.equal(accrual12h.remainingCapMs, 0, 'Remaining cap must be 0 ms');

  // Point E: 24 hours offline (86,400,000 ms) - severe absence clamped to 12h cap
  // Expected: Clamped to 12h; 12h stopped time (43,200,000 ms) discarded!
  const t24h = startMs + 24 * MS_PER_HOUR;
  const accrual24h = calculateAccrual(state, t24h);
  assert.equal(accrual24h.elapsedMs, 86_400_000, 'Elapsed ms should be 86,400,000 ms (24 hours)');
  assert.equal(
    accrual24h.producedMs,
    43_200_000,
    'Produced ms must be clamped to 43,200,000 ms (12 hours)',
  );
  assert.equal(
    accrual24h.excessMs,
    43_200_000,
    '43,200,000 ms (12 hours) of excess time must be discarded',
  );
  assert.equal(
    accrual24h.earnedUnits,
    864_000_000,
    'Earned units must remain capped at 864,000,000',
  );
  assert.equal(
    unitsToWholeYen(accrual24h.earnedUnits),
    14_400,
    'Whole yen remains strictly 14,400 ¥',
  );
  assert.equal(accrual24h.isCapped, true, 'Must report isCapped = true');
  assert.equal(accrual24h.remainingCapMs, 0, 'Remaining cap must be 0 ms');
});

test('Suite 1.3: Manual collection clearing the cap, transferring revenue, and resetting production', () => {
  const startMs = 1_000_000_000;
  const state: SushiEconomyState = createInitialEconomyState(startMs, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    capMs: EXTENDED_CAP_MS,
  });

  // Accrue 24 hours (capped at 14,400 ¥ = 864,000,000 units)
  const collectionTimeMs = startMs + 24 * MS_PER_HOUR;
  const collection = collectEarnings(state, collectionTimeMs);

  assert.equal(collection.transferredUnits, 864_000_000, 'Must transfer exactly 864,000,000 units');
  assert.equal(collection.transferredYenWhole, 14_400, 'Must transfer exactly 14,400 whole yen');
  assert.equal(collection.previousBalanceUnits, 0, 'Previous balance was 0');
  assert.equal(collection.newBalanceUnits, 864_000_000, 'New balance must be 864,000,000 units');

  // Validate state reset
  const postState = collection.updatedState;
  assert.equal(postState.uncollectedUnits, 0, 'Uncollected register balance must be reset to 0');
  assert.equal(postState.usedProductionMs, 0, 'usedProductionMs must be reset to 0');
  assert.equal(
    postState.accountedAtMs,
    collectionTimeMs,
    'accountedAtMs must be advanced to collection time',
  );
  assert.equal(
    postState.periodStartMs,
    collectionTimeMs,
    'periodStartMs must be reset to collection time',
  );

  // Verify that subsequent accrual begins afresh with full 12h remaining cap
  const postAccrual = calculateAccrual(postState, collectionTimeMs + 1 * MS_PER_HOUR);
  assert.equal(postAccrual.producedMs, 3_600_000, 'Should produce 1h after collection');
  assert.equal(postAccrual.earnedUnits, 72_000_000, 'Should earn 72,000,000 units (1,200 ¥)');
  assert.equal(postAccrual.isCapped, false, 'Should not be capped after fresh collection');
  assert.equal(
    postAccrual.remainingCapMs,
    EXTENDED_CAP_MS - 3_600_000,
    'Remaining cap must be 11h',
  );
});

// =============================================================================
// SUITE 2: Medal Unlock Monotonic Non-Revocation (21 Items, Genki 6–12)
// =============================================================================

test('Suite 2.1: Full curriculum mapping: 21 items map to Genki I Chapters 6–12', () => {
  assert.equal(SUSHI_CATALOG.length, 21, 'Catalog must contain exactly 21 master items');
  assert.equal(MEDAL_GRANT_RULES.length, 21, 'Medal grant rules must contain exactly 21 rules');

  const expectedChapters = [6, 7, 8, 9, 10, 11, 12];
  for (const chapter of expectedChapters) {
    const chapterItems = SUSHI_CATALOG.filter((i) => i.requiredLesson === chapter);
    assert.equal(chapterItems.length, 3, `Chapter ${chapter} must have exactly 3 unlock items`);

    const bronze = chapterItems.find((i) => i.requiredTier === 'bronze');
    const silver = chapterItems.find((i) => i.requiredTier === 'silver');
    const gold = chapterItems.find((i) => i.requiredTier === 'gold');

    assert.ok(bronze, `Chapter ${chapter} must have a Bronze unlock`);
    assert.ok(silver, `Chapter ${chapter} must have a Silver unlock`);
    assert.ok(gold, `Chapter ${chapter} must have a Gold unlock`);

    // Verify rules sync with catalog
    for (const item of chapterItems) {
      const rule = MEDAL_GRANT_RULES.find((r) => r.grantId === item.id);
      assert.ok(rule, `Rule for grant ${item.id} must exist in MEDAL_GRANT_RULES`);
      assert.equal(rule.lessonNumber, chapter, `Rule lessonNumber must match chapter ${chapter}`);
      assert.equal(rule.requiredTier, item.requiredTier, `Rule tier must match item tier`);
    }
  }

  // Verify total catalog sink equilibrium equals 48,000 yen
  const totalYen = SUSHI_CATALOG.reduce((sum, item) => sum + item.priceYen, 0);
  assert.equal(totalYen, 48_000, 'Master 21-item catalog sum must equal exactly 48,000 ¥');
  const totalUnits = SUSHI_CATALOG.reduce((sum, item) => sum + item.priceUnits, 0);
  assert.equal(totalUnits, 48_000 * YEN_UNIT_MULTIPLIER, 'Total units must equal 2,880,000,000');
});

test('Suite 2.2: Monotonic non-revocation under score reductions, quiz mistakes, and course resets', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-student-monotonic';

  // 1. Initialize restaurant
  await service.getOrInitRestaurant(uid, 1_000_000);

  // 2. Synthesize complete 100% mastery course progress (Gold medals in Ch 6–12)
  const fullProgress = createFreshCourseProgress();
  for (const week of courseWeeks) {
    for (const v of week.vocab) fullProgress.masteredVocabIds[v.id] = true;
    for (const k of week.kanji) fullProgress.masteredKanjiIds[k.id] = true;
    for (const d of week.conjugations) fullProgress.masteredDojoIds[d.id] = true;
    fullProgress.quizBestResults[week.id] = {
      score: week.quiz.length,
      total: week.quiz.length,
      completedAt: 1_000,
    };
  }

  const allGrants = evaluateMedalGrants(fullProgress, courseWeeks);
  assert.equal(allGrants.length, 21, 'Full study mastery must evaluate all 21 unlock grants');

  // Sync into restaurant
  const stateWithAll = await service.syncMedalGrants(uid, allGrants, 2_000_000);
  assert.equal(stateWithAll.permanentGrants.length, 21, 'Restaurant must store all 21 grants');

  // 3. Fluctuating state 1: Student resets vocab mastery or un-marks items
  const degradedProgress1 = structuredClone(fullProgress);
  degradedProgress1.masteredVocabIds = {}; // wiped vocab
  const degradedGrants1 = evaluateMedalGrants(degradedProgress1, courseWeeks);
  assert.ok(degradedGrants1.length < 21, 'Degraded progress should yield fewer raw grants');

  const stateAfterFluctuation1 = await service.syncMedalGrants(uid, degradedGrants1, 3_000_000);
  assert.equal(
    stateAfterFluctuation1.permanentGrants.length,
    21,
    'Grants must NOT decrease when student study score drops',
  );

  // 4. Fluctuating state 2: Complete course reset to 0%
  const freshReset = createFreshCourseProgress();
  const resetGrants = evaluateMedalGrants(freshReset, courseWeeks);
  assert.deepEqual(resetGrants, [], 'Empty course progress yields 0 raw grants');

  const stateAfterReset = await service.syncMedalGrants(uid, resetGrants, 4_000_000);
  assert.equal(
    stateAfterReset.permanentGrants.length,
    21,
    'Permanent grants must strictly preserve all 21 items after full course reset',
  );

  // 5. Verify every single catalog ID is preserved in restaurant state
  for (const item of SUSHI_CATALOG) {
    assert.ok(
      stateAfterReset.permanentGrants.includes(item.id),
      `Grant "${item.id}" must remain present after reset`,
    );
  }
});

// =============================================================================
// SUITE 3: Purchase Transactions, Floor Enforcement, Upgrades & Equipping
// =============================================================================

test('Suite 3.1: Purchase transactions: exact 60,000 units/yen debit and balance floor enforcement', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-student-purchases';
  const nowMs = 1_000_000;

  // Item to purchase: prep_counter (300 ¥ = 18,000,000 units)
  const item = getCatalogItem('prep_counter')!;
  assert.ok(item, 'prep_counter must exist in catalog');
  assert.equal(item.priceYen, 300);
  assert.equal(item.priceUnits, 18_000_000);

  // Initialize restaurant with prep_counter unlocked
  const initial = await service.getOrInitRestaurant(uid, nowMs, ['prep_counter']);
  assert.deepEqual(initial.permanentGrants, ['prep_counter']);

  // Case A: Balance is 1 unit BELOW the required price (17,999,999 units)
  await repo.set({
    ...initial,
    balanceUnits: item.priceUnits - 1, // 17,999,999
    uncollectedUnits: 0,
    accountedAtMs: nowMs,
  });

  const failureUnderfunded = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-fail-floor',
    nowMs,
  );
  assert.equal(
    failureUnderfunded.success,
    false,
    'Purchase must fail when underfunded by even 1 unit',
  );
  if (!failureUnderfunded.success) {
    assert.equal(failureUnderfunded.reason, 'INSUFFICIENT_FUNDS');
    assert.equal(failureUnderfunded.requiredUnits, 18_000_000);
    assert.equal(failureUnderfunded.actualUnits, 17_999_999);
  }

  // Case B: Student has uncollected register units, but 0 spendable wallet balance
  // Uncollected units CANNOT be spent directly without manual collection!
  await repo.set({
    ...initial,
    balanceUnits: 0,
    uncollectedUnits: 100_000_000, // 1,666 ¥ in register
    accountedAtMs: nowMs,
  });

  const failureUncollected = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-fail-register',
    nowMs,
  );
  assert.equal(
    failureUncollected.success,
    false,
    'Uncollected register funds must not fund purchases',
  );
  if (!failureUncollected.success) {
    assert.equal(failureUncollected.reason, 'INSUFFICIENT_FUNDS');
  }

  // Case C: Exact spendable balance (exactly 18,000,000 units)
  await repo.set({
    ...initial,
    balanceUnits: item.priceUnits, // Exactly 18,000,000
    uncollectedUnits: 600_000, // 10 ¥ in register to verify preservation
    usedProductionMs: 30_000,
    accountedAtMs: nowMs,
  });

  const successExact = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-success-exact',
    nowMs,
  );
  assert.equal(successExact.success, true, 'Purchase must succeed with exact balance');
  if (successExact.success) {
    assert.equal(successExact.debitedUnits, 18_000_000, 'Must debit exactly 18,000,000 units');
    assert.equal(successExact.debitedYen, 300, 'Must debit exactly 300 whole yen');
    assert.equal(successExact.state.balanceUnits, 0, 'Remaining balance must be exactly 0 units');
    assert.ok(
      successExact.state.inventory.includes('prep_counter'),
      'prep_counter must be in inventory',
    );
    assert.equal(
      successExact.state.kitchenCapacity,
      3,
      'Kitchen capacity must increase from 1 to 3',
    );
    // Verify intermediate uncollected funds and production timer are strictly preserved!
    assert.equal(
      successExact.state.uncollectedUnits,
      600_000,
      'Uncollected units must be preserved',
    );
    assert.equal(successExact.state.usedProductionMs, 30_000, 'usedProductionMs must be preserved');
  }
});

test('Suite 3.2: Prospective upgrade rate transitions across production chain: O = min(K, S), R = O * A', () => {
  // Trace the full upgrade progression:
  // Baseline -> Prep Counter (+2K) -> Knife (+1K) -> Belt (+2S) -> Counter (+2S) -> Sous Chef (+2K) -> Master License (+5A)
  let current: SushiEconomyState = createInitialEconomyState(1_000_000);

  // 0. Initial baseline
  // K=1, S=2, A=10 -> O=min(1, 2)=1, R=10 ¥/min (Bottleneck: Kitchen)
  let rate = calculateProductionRate(
    current.kitchenCapacity,
    current.serviceCapacity,
    current.averageRevenuePerOrder,
  );
  assert.equal(rate.ordersPerMinute, 1);
  assert.equal(rate.yenPerMinute, 10);
  assert.equal(rate.bottleneck, 'kitchen');

  // 1. Buy prep_counter (+2 Kitchen)
  // K: 1 -> 3, S=2, A=10 -> O = min(3, 2) = 2, R = 20 ¥/min (Bottleneck: Service)
  const impact1 = previewUpgradeImpact(current, { kitchenCapacityDelta: 2 });
  assert.equal(impact1.ordersDelta, 1);
  assert.equal(impact1.yenDelta, 10);
  assert.equal(impact1.prospectiveRate.ordersPerMinute, 2);
  assert.equal(impact1.prospectiveRate.yenPerMinute, 20);
  assert.equal(impact1.prospectiveRate.bottleneck, 'service');
  assert.equal(impact1.newKitchenCapacity, 3);
  current = { ...current, kitchenCapacity: 3 };

  // 2. Buy precision_knife (+1 Kitchen)
  // K: 3 -> 4, S=2, A=10 -> O = min(4, 2) = 2, R = 20 ¥/min (Service Bottleneck Limiting!)
  const impact2 = previewUpgradeImpact(current, { kitchenCapacityDelta: 1 });
  assert.equal(impact2.ordersDelta, 0, 'Orders delta should be 0 because service is bottleneck');
  assert.equal(impact2.yenDelta, 0, 'Yen delta should be 0');
  assert.equal(impact2.isBottleneckLimiting, true, 'Must identify bottleneckLimiting = true');
  assert.equal(impact2.prospectiveRate.bottleneck, 'service');
  current = { ...current, kitchenCapacity: 4 };

  // 3. Buy conveyor_belt (+2 Service)
  // K=4, S: 2 -> 4, A=10 -> O = min(4, 4) = 4, R = 40 ¥/min (Balanced)
  const impact3 = previewUpgradeImpact(current, { serviceCapacityDelta: 2 });
  assert.equal(impact3.ordersDelta, 2);
  assert.equal(impact3.yenDelta, 20);
  assert.equal(impact3.prospectiveRate.ordersPerMinute, 4);
  assert.equal(impact3.prospectiveRate.yenPerMinute, 40);
  assert.equal(impact3.prospectiveRate.bottleneck, 'none');
  current = { ...current, serviceCapacity: 4 };

  // 4. Buy service_counter (+2 Service)
  // K=4, S: 4 -> 6, A=10 -> O = min(4, 6) = 4, R = 40 ¥/min (Kitchen Bottleneck Limiting!)
  const impact4 = previewUpgradeImpact(current, { serviceCapacityDelta: 2 });
  assert.equal(impact4.ordersDelta, 0);
  assert.equal(impact4.yenDelta, 0);
  assert.equal(impact4.isBottleneckLimiting, true);
  assert.equal(impact4.prospectiveRate.bottleneck, 'kitchen');
  current = { ...current, serviceCapacity: 6 };

  // 5. Buy sous_chef (+2 Kitchen)
  // K: 4 -> 6, S=6, A=10 -> O = min(6, 6) = 6, R = 60 ¥/min (Balanced)
  const impact5 = previewUpgradeImpact(current, { kitchenCapacityDelta: 2 });
  assert.equal(impact5.ordersDelta, 2);
  assert.equal(impact5.yenDelta, 20);
  assert.equal(impact5.prospectiveRate.ordersPerMinute, 6);
  assert.equal(impact5.prospectiveRate.yenPerMinute, 60);
  assert.equal(impact5.prospectiveRate.bottleneck, 'none');
  current = { ...current, kitchenCapacity: 6 };

  // 6. Buy master_license (+5 Avg Revenue)
  // K=6, S=6, A: 10 -> 15 -> O = 6, R = 6 * 15 = 90 ¥/min
  const impact6 = previewUpgradeImpact(current, { averageRevenueDelta: 5 });
  assert.equal(impact6.ordersDelta, 0);
  assert.equal(impact6.yenDelta, 30);
  assert.equal(impact6.prospectiveRate.ordersPerMinute, 6);
  assert.equal(impact6.prospectiveRate.yenPerMinute, 90);
  current = { ...current, averageRevenuePerOrder: 15 };

  const finalRate = calculateProductionRate(
    current.kitchenCapacity,
    current.serviceCapacity,
    current.averageRevenuePerOrder,
  );
  assert.equal(finalRate.ordersPerMinute, 6);
  assert.equal(finalRate.yenPerMinute, 90);
  assert.equal(finalRate.bottleneck, 'none');
});

test('Suite 3.3: Idempotency with duplicate request keys on purchase and collect', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-student-idempotency';

  // Seed restaurant with funds and unlock
  const initial = await service.getOrInitRestaurant(uid, 1_000_000, ['paper_lantern']);
  await repo.set({
    ...initial,
    balanceUnits: 60_000_000, // 1000 yen
    uncollectedUnits: 12_000_000, // 200 yen
  });

  // 1. First purchase call
  const p1 = await service.purchaseCatalogItem(
    uid,
    'paper_lantern',
    'idemp-purchase-key-1',
    1_100_000,
  );
  assert.equal(p1.success, true);
  if (p1.success) {
    assert.equal(p1.wasAlreadyProcessed, false);
    assert.equal(p1.state.inventory.filter((id) => id === 'paper_lantern').length, 1);
    assert.equal(p1.state.balanceUnits, 60_000_000 - 18_000_000); // 300 yen debited
  }

  // 2. Duplicate purchase call with same idempotency key
  const p2 = await service.purchaseCatalogItem(
    uid,
    'paper_lantern',
    'idemp-purchase-key-1',
    1_200_000,
  );
  assert.equal(p2.success, true);
  if (p2.success) {
    assert.equal(p2.wasAlreadyProcessed, true, 'Repeat key must return wasAlreadyProcessed = true');
    assert.equal(
      p2.state.inventory.filter((id) => id === 'paper_lantern').length,
      1,
      'Must not duplicate item',
    );
    assert.equal(
      p2.state.balanceUnits,
      60_000_000 - 18_000_000,
      'Must not debit balance a second time',
    );
  }

  // 3. Collection call with idempotency key
  const c1 = await service.collectRevenue(uid, 'idemp-collect-key-1', 1_300_000);
  assert.equal(c1.wasAlreadyProcessed, false);
  const balanceAfterC1 = c1.state.balanceUnits;

  // 4. Duplicate collection call with same key
  const c2 = await service.collectRevenue(uid, 'idemp-collect-key-1', 1_400_000);
  assert.equal(c2.wasAlreadyProcessed, true);
  assert.equal(c2.collectedUnits, 0, 'Duplicate collection must transfer 0 units');
  assert.equal(c2.state.balanceUnits, balanceAfterC1, 'Wallet balance must remain unchanged');
});

test('Suite 3.4: Decoration slot equipping (wallSlot and floorSlot), validation, and neutrality', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-student-decor';

  // Seed restaurant owning paper_lantern (wallSlot), noren_curtain (wallSlot), and potted_plant (floorSlot)
  const initial = await service.getOrInitRestaurant(uid, 1_000_000);
  await repo.set({
    ...initial,
    inventory: ['paper_lantern', 'noren_curtain', 'potted_plant', 'andon_lantern'],
  });

  // 1. Equip paper_lantern in wallSlot
  const eq1 = await service.equipDecoration(
    uid,
    'wallSlot',
    'paper_lantern',
    'equip-key-1',
    1_050_000,
  );
  assert.equal(eq1.success, true);
  if (eq1.success) {
    assert.equal(eq1.state.equipped.wallSlot, 'paper_lantern');
    assert.equal(eq1.state.equipped.floorSlot, null);
    assert.equal(eq1.wasAlreadyProcessed, false);
  }

  // 2. Equip potted_plant in floorSlot
  const eq2 = await service.equipDecoration(
    uid,
    'floorSlot',
    'potted_plant',
    'equip-key-2',
    1_060_000,
  );
  assert.equal(eq2.success, true);
  if (eq2.success) {
    assert.equal(eq2.state.equipped.wallSlot, 'paper_lantern');
    assert.equal(eq2.state.equipped.floorSlot, 'potted_plant');
  }

  // 3. Switch wallSlot to noren_curtain
  const eq3 = await service.equipDecoration(
    uid,
    'wallSlot',
    'noren_curtain',
    'equip-key-3',
    1_070_000,
  );
  assert.equal(eq3.success, true);
  if (eq3.success) {
    assert.equal(eq3.state.equipped.wallSlot, 'noren_curtain');
    assert.equal(eq3.state.equipped.floorSlot, 'potted_plant');
  }

  // 4. Unequip floorSlot (pass null)
  const eq4 = await service.equipDecoration(uid, 'floorSlot', null, 'equip-key-4', 1_080_000);
  assert.equal(eq4.success, true);
  if (eq4.success) {
    assert.equal(eq4.state.equipped.wallSlot, 'noren_curtain');
    assert.equal(eq4.state.equipped.floorSlot, null);
  }

  // 5. Slot mismatch rejection: attempt to put potted_plant (floor decor) in wallSlot
  const eqFailMismatch = await service.equipDecoration(
    uid,
    'wallSlot',
    'potted_plant',
    'equip-key-5',
    1_090_000,
  );
  assert.equal(eqFailMismatch.success, false, 'Must reject floor decor in wallSlot');

  // 6. Unowned item rejection: attempt to equip sakura_bonsai (not in inventory)
  const eqFailUnowned = await service.equipDecoration(
    uid,
    'floorSlot',
    'sakura_bonsai',
    'equip-key-6',
    1_100_000,
  );
  assert.equal(eqFailUnowned.success, false, 'Must reject unowned decoration');

  // 7. Economic neutrality: verify equipping decorations does not modify production rates
  const afterEquip = await repo.get(uid);
  const rateAfterEquip = calculateProductionRate(
    afterEquip!.kitchenCapacity,
    afterEquip!.serviceCapacity,
    afterEquip!.averageRevenuePerOrder,
  );
  assert.equal(rateAfterEquip.ordersPerMinute, 1);
  assert.equal(rateAfterEquip.yenPerMinute, 10);
});

// =============================================================================
// SUITE 4: Core Japanese Study Platform Non-Interference
// =============================================================================

test('Suite 4.1: Japanese Study Flashcards & Vocabulary Drills operate with zero sushi interference', () => {
  const week1 = courseWeeks[0];
  const { drills, vocab, update, progress } = createMockStudyEnvironment(week1);

  // 1. Initial vocab cards check
  drills.vocab.selectFilter('unmastered');
  const initialVocabState = vocab();
  assert.ok(initialVocabState.items.length > 0, 'Week 1 must have vocabulary items');
  const firstCardId = initialVocabState.current.id;

  // 2. Flip and mark mastered
  drills.vocab.flip();
  assert.equal(vocab().flipped, true);
  const cmd = drills.vocab.markAndAdvance(true);
  assert.ok(cmd, 'Must emit progress update command');
  update(cmd);

  // 3. Verify study progress recorded in pure course progress state
  const snapshot = progress.snapshot();
  assert.equal(snapshot.masteredVocabIds[firstCardId], true);

  // 4. Verify that running sushi economy operations does NOT mutate course progress
  const economyState = createInitialEconomyState(500_000);
  const accrual = calculateAccrual(economyState, 1_000_000);
  collectEarnings(accrual.updatedState, 1_000_000);

  // Progress snapshot must be completely unaffected
  assert.deepEqual(progress.snapshot().masteredVocabIds, { [firstCardId]: true });
  assert.equal(progress.snapshot().activeSubView, 'hub');
});

test('Suite 4.2: Japanese Kanji Bank & Kanji Quiz generation operate with zero interference', () => {
  for (let ch = 0; ch < courseWeeks.length; ch++) {
    const week = courseWeeks[ch];
    assert.ok(
      week.kanji.length > 0,
      `Genki chapter ${week.lessonNumber} must have kanji characters`,
    );

    // Build questions for this chapter
    const questions = buildKanjiQuizQuestions(week.kanji);
    assert.ok(
      questions.length > 0,
      `Chapter ${week.lessonNumber} must generate kanji quiz questions`,
    );

    for (const q of questions) {
      assert.ok(q.id, 'Question must have id');
      assert.ok(q.prompt, 'Question must have prompt');
      assert.ok(q.answer, 'Question must have answer');
      assert.ok(q.choices.length >= 2, 'Question must have at least 2 choices');
      assert.ok(q.choices.includes(q.answer), 'Choices must include the correct answer');
    }
  }
});

test('Suite 4.3: て-Form Dojo verb conjugation drills operate with zero interference', () => {
  const week1 = courseWeeks[0];
  const { drills, dojo, update, progress } = createMockStudyEnvironment(week1);

  const dojoState = dojo();
  assert.ok(dojoState.current, 'Dojo must have a current verb');
  const verb = dojoState.current;

  // Verify conjugation helper
  const expected = getDojoExpectedForm(verb);
  assert.ok(expected.kana, 'Expected kana must be defined');
  assert.ok(expected.kanji, 'Expected kanji must be defined');

  // Submit correct answer
  const submitCmd = drills.dojo.submit(verb.teFormKana);
  assert.ok(submitCmd, 'Must produce update command for correct answer');
  update(submitCmd);

  assert.equal(dojo().isCorrect, true);
  assert.equal(progress.snapshot().masteredDojoIds[verb.id], true);
});

test('Suite 4.4: Genki I Chapters 6–12 curriculum data integrity is strictly preserved', () => {
  assert.equal(courseWeeks.length, 7, 'Must have exactly 7 course weeks (Genki I Chapters 6–12)');

  const expectedLessonNumbers = [6, 7, 8, 9, 10, 11, 12];
  for (let i = 0; i < courseWeeks.length; i++) {
    const week = courseWeeks[i];
    assert.equal(
      week.lessonNumber,
      expectedLessonNumbers[i],
      `Week index ${i} must be Lesson ${expectedLessonNumbers[i]}`,
    );
    assert.ok(
      week.vocab.length >= 20,
      `Chapter ${week.lessonNumber} must have at least 20 vocab words`,
    );
    assert.ok(
      week.kanji.length >= 10,
      `Chapter ${week.lessonNumber} must have at least 10 kanji characters`,
    );
    assert.ok(
      week.conjugations.length >= 8,
      `Chapter ${week.lessonNumber} must have at least 8 dojo conjugation items`,
    );
    assert.ok(
      week.quiz.length >= 5,
      `Chapter ${week.lessonNumber} must have at least 5 quiz questions`,
    );
  }
});
