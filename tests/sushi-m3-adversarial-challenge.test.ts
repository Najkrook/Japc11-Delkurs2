/**
 * Empirical Adversarial Challenge Test Suite for Milestone 3
 * Role: challenger_m3_1 (critic, specialist)
 * Target:
 *   - src/course/sushi-game/catalog.ts
 *   - src/course/sushi-game/medals.ts
 *   - src/course/sushi-game/economy.ts
 *   - src/course/sushi-game/domain-service.ts
 *   - src/course/sushi-game/service.ts
 *
 * Verifies:
 * 1. 21-Item Catalog Integrity: exact prices, integer units, requirements, non-negativity.
 * 2. Prospective Rate Impact Oracle & master_license (+5 yen/order) across production states.
 * 3. Two-Capacity Bottleneck O = min(K, S) across all 32 upgrade power-set combinations.
 * 4. Curriculum Progression Simulation (Chapters 6 to 12) with monotonic non-revocation.
 * 5. Purchase Transaction Lifecycle & Boundary Invariance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUSHI_CATALOG,
  getCatalogItem,
  isCatalogItem,
  previewUpgradeImpact,
  previewCatalogPurchase,
  type SushiCatalogItem,
} from '../src/course/sushi-game/catalog.ts';

import {
  MEDAL_GRANT_RULES,
  evaluateMedalGrants,
  mergePermanentGrants,
  tierSatisfies,
  type UnlockGrantId,
  type MedalTier,
} from '../src/course/sushi-game/medals.ts';

import {
  calculateProductionRate,
  calculateAccrual,
  unitsToWholeYen,
  yenToUnits,
  canAfford,
  createInitialEconomyState,
} from '../src/course/sushi-game/economy.ts';

import {
  YEN_UNIT_MULTIPLIER,
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
} from '../src/course/sushi-game/types.ts';
import type {
  SushiEconomyState,
  SushiRestaurantState,
} from '../src/course/sushi-game/types.ts';

import { courseWeeks, getCourseWeekById } from '../src/course/data/index.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import type { CourseProgressData, CourseWeek } from '../src/course/types.ts';

import {
  SushiService,
  InMemorySushiRepository,
} from '../src/course/sushi-game/service.ts';

// Helper to set week progress ratio
function setWeekMasteryRatio(
  progress: CourseProgressData,
  week: CourseWeek,
  ratio: number,
): void {
  const total = week.vocab.length + week.kanji.length + week.conjugations.length + week.quiz.length;
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

function createMockRestaurant(overrides: Partial<SushiRestaurantState> = {}): SushiRestaurantState {
  return {
    id: 'adversarial-user',
    kitchenCapacity: 1,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    activeRecipe: 'classic_nigiri',
    balanceUnits: 60_000_000,
    uncollectedUnits: 0,
    usedProductionMs: 0,
    capMs: DEFAULT_CAP_MS,
    periodStartMs: 1_000_000,
    lastCalculatedMs: 1_000_000,
    permanentGrants: [],
    inventory: [],
    equipped: {
      wallSlot: null,
      floorSlot: null,
    },
    ...overrides,
  };
}

// =============================================================================
// CHALLENGE 1: EXHAUSTIVE CATALOG INTEGRITY & PROPERTY VERIFICATION
// =============================================================================

test('M3-CHALLENGE-01: Exhaustive Catalog Integrity & Economic Constant Verification', () => {
  assert.equal(SUSHI_CATALOG.length, 21, 'Catalog must contain exactly 21 canonical items');

  const seenIds = new Set<string>();
  let totalYen = 0;
  let totalUnits = 0;

  const expectedChapters = [6, 7, 8, 9, 10, 11, 12];
  const expectedTiers: MedalTier[] = ['bronze', 'silver', 'gold'];

  for (const item of SUSHI_CATALOG) {
    // 1. Unique non-empty ID
    assert.ok(item.id && typeof item.id === 'string', 'Item ID must be non-empty string');
    assert.ok(!seenIds.has(item.id), `Duplicate catalog item ID found: ${item.id}`);
    seenIds.add(item.id);
    assert.ok(isCatalogItem(item.id), `isCatalogItem must recognize ${item.id}`);

    // 2. Canonical lookup
    const lookup = getCatalogItem(item.id);
    assert.ok(lookup, `getCatalogItem(${item.id}) must return item`);
    assert.equal(lookup?.id, item.id);

    // 3. String properties non-empty
    assert.ok(item.name && item.name.trim().length > 0, `Item ${item.id} name required`);
    assert.ok(item.icon && item.icon.trim().length > 0, `Item ${item.id} icon required`);
    assert.ok(item.category && typeof item.category === 'string', `Item ${item.id} category required`);
    assert.ok(item.categoryLabel && item.categoryLabel.trim().length > 0, `Item ${item.id} categoryLabel required`);
    assert.ok(item.effectDescription && item.effectDescription.trim().length > 0, `Item ${item.id} description required`);

    // 4. Non-negative integer pricing
    assert.ok(Number.isInteger(item.priceYen), `Item ${item.id} priceYen must be integer`);
    assert.ok(item.priceYen >= 0, `Item ${item.id} priceYen must be non-negative`);
    assert.equal(
      item.priceUnits,
      item.priceYen * YEN_UNIT_MULTIPLIER,
      `Item ${item.id} priceUnits must exactly match priceYen * 60,000`,
    );

    totalYen += item.priceYen;
    totalUnits += item.priceUnits;

    // 5. Requirements validation
    assert.ok(
      expectedChapters.includes(item.requiredLesson),
      `Item ${item.id} lesson ${item.requiredLesson} must be between 6 and 12`,
    );
    assert.ok(
      expectedTiers.includes(item.requiredTier),
      `Item ${item.id} tier ${item.requiredTier} must be bronze, silver, or gold`,
    );

    if (item.requiredTier === 'bronze') {
      assert.equal(item.requiredPercent, 60, `Bronze item ${item.id} requires 60%`);
      assert.equal(item.requiredTierLabel, 'Brons');
    } else if (item.requiredTier === 'silver') {
      assert.equal(item.requiredPercent, 80, `Silver item ${item.id} requires 80%`);
      assert.equal(item.requiredTierLabel, 'Silver');
    } else if (item.requiredTier === 'gold') {
      assert.equal(item.requiredPercent, 100, `Gold item ${item.id} requires 100%`);
      assert.equal(item.requiredTierLabel, 'Guld');
    }

    // 6. Target week mapping
    const expectedWeekId = `week-${item.requiredLesson - 5}`;
    assert.equal(
      item.targetWeekId,
      expectedWeekId,
      `Item ${item.id} targetWeekId must be ${expectedWeekId}`,
    );

    // 7. Stat delta validity
    if (item.kitchenCapacityDelta !== undefined) {
      assert.ok(Number.isInteger(item.kitchenCapacityDelta) && item.kitchenCapacityDelta > 0);
    }
    if (item.serviceCapacityDelta !== undefined) {
      assert.ok(Number.isInteger(item.serviceCapacityDelta) && item.serviceCapacityDelta > 0);
    }
    if (item.averageRevenueDelta !== undefined) {
      assert.ok(Number.isInteger(item.averageRevenueDelta) && item.averageRevenueDelta > 0);
    }
    if (item.newCapMs !== undefined) {
      assert.equal(item.newCapMs, EXTENDED_CAP_MS);
    }
  }

  // Exact macroeconomic balance totals
  assert.equal(totalYen, 48_000, 'Sum of all 21 items must equal exactly 48,000 Yen');
  assert.equal(totalUnits, 2_880_000_000, 'Sum of units must equal exactly 2,880,000,000 units');

  // Tier distributions and sums
  const bronze = SUSHI_CATALOG.filter((i) => i.requiredTier === 'bronze');
  const silver = SUSHI_CATALOG.filter((i) => i.requiredTier === 'silver');
  const gold = SUSHI_CATALOG.filter((i) => i.requiredTier === 'gold');

  assert.equal(bronze.length, 7);
  assert.equal(silver.length, 7);
  assert.equal(gold.length, 7);

  assert.equal(bronze.reduce((acc, i) => acc + i.priceYen, 0), 31_500, 'Bronze upgrades sum to 31,500 Yen');
  assert.equal(silver.reduce((acc, i) => acc + i.priceYen, 0), 11_400, 'Silver recipes sum to 11,400 Yen');
  assert.equal(gold.reduce((acc, i) => acc + i.priceYen, 0), 5_100, 'Gold decor sum to 5,100 Yen');
});

// =============================================================================
// CHALLENGE 2: PROSPECTIVE RATE IMPACT ORACLE & MASTER_LICENSE (+5 YEN/ORDER)
// =============================================================================

test('M3-CHALLENGE-02: Prospective Rate Impact Oracle & master_license Math Verification', () => {
  // Test master_license across various capacity combinations
  for (let k = 1; k <= 8; k++) {
    for (let s = 1; s <= 8; s++) {
      const orders = Math.min(k, s);
      const state = createMockRestaurant({
        kitchenCapacity: k,
        serviceCapacity: s,
        averageRevenuePerOrder: 10,
      });

      const preview = previewCatalogPurchase(state, 'master_license');
      assert.ok(preview, 'Preview for master_license must succeed');

      // Orders per minute must remain unchanged
      assert.equal(preview.ordersDelta, 0, 'Revenue upgrade does not change order throughput');
      assert.equal(preview.prospectiveRate.ordersPerMinute, orders);

      // Current rate: orders * 10
      assert.equal(preview.currentRate.yenPerMinute, orders * 10);

      // Prospective rate: orders * 15
      assert.equal(preview.prospectiveRate.yenPerMinute, orders * 15);

      // Yen delta: +5 yen per order -> orders * 5 yen/min
      const expectedDelta = orders * 5;
      assert.equal(preview.yenDelta, expectedDelta, `master_license delta for orders=${orders}`);

      assert.equal(preview.hasImmediateEffect, true, 'Immediate rate increase');
      assert.equal(preview.isBottleneckLimiting, false, 'master_license is never bottleneck limited');

      // Educational explanation must explain +5 yen and rate delta
      assert.ok(
        preview.educationalExplanation.includes('10 till 15 ¥/order'),
        `Explanation should state 10 till 15: ${preview.educationalExplanation}`,
      );
      assert.ok(
        preview.educationalExplanation.includes(`+${expectedDelta} ¥/min`),
        `Explanation should state +${expectedDelta} ¥/min: ${preview.educationalExplanation}`,
      );
    }
  }

  // Previews for non-revenue, non-capacity items (recipes and decor)
  const passiveItems = SUSHI_CATALOG.filter(
    (i) => i.category === 'recipe' || i.category === 'decoration',
  );

  const testState = createMockRestaurant({ kitchenCapacity: 4, serviceCapacity: 4 });
  for (const item of passiveItems) {
    const preview = previewCatalogPurchase(testState, item.id);
    assert.ok(preview);
    assert.equal(preview.ordersDelta, 0);
    assert.equal(preview.yenDelta, 0);
    assert.equal(preview.hasImmediateEffect, false);
    assert.equal(preview.isBottleneckLimiting, false);
    assert.equal(preview.educationalExplanation, item.effectDescription);
  }

  // Cap extension item preview
  const capPreview = previewCatalogPurchase(testState, 'cap_extension_12h');
  assert.ok(capPreview);
  assert.equal(capPreview.ordersDelta, 0);
  assert.equal(capPreview.yenDelta, 0);
  assert.equal(capPreview.hasImmediateEffect, true);
  assert.equal(capPreview.isBottleneckLimiting, false);
  assert.equal(capPreview.newCapMs, EXTENDED_CAP_MS);
  assert.ok(capPreview.educationalExplanation.includes('+4 timmar'));
});

// =============================================================================
// CHALLENGE 3: EXHAUSTIVE BOTTLENECK SPACE & POWER-SET VERIFICATION (32 SUBSETS)
// =============================================================================

test('M3-CHALLENGE-03: Exhaustive Bottleneck Space & Alternation Verification (32 Subsets)', () => {
  // The 5 capacity items:
  // 1. prep_counter: K + 2
  // 2. precision_knife: K + 1
  // 3. conveyor_belt: S + 2
  // 4. service_counter: S + 2
  // 5. sous_chef: K + 2
  const capacityItems = [
    { id: 'prep_counter', kDelta: 2, sDelta: 0 },
    { id: 'precision_knife', kDelta: 1, sDelta: 0 },
    { id: 'conveyor_belt', kDelta: 0, sDelta: 2 },
    { id: 'service_counter', kDelta: 0, sDelta: 2 },
    { id: 'sous_chef', kDelta: 2, sDelta: 0 },
  ];

  // Exhaustively test all 2^5 = 32 subsets of capacity upgrades
  for (let mask = 0; mask < 32; mask++) {
    let k = 1; // base kitchen
    let s = 2; // base service
    for (let bit = 0; bit < 5; bit++) {
      if ((mask & (1 << bit)) !== 0) {
        k += capacityItems[bit].kDelta;
        s += capacityItems[bit].sDelta;
      }
    }

    const expectedOrders = Math.min(k, s);
    const expectedYenRate = expectedOrders * 10;
    const expectedBottleneck = k < s ? 'kitchen' : s < k ? 'service' : 'none';

    const rate = calculateProductionRate(k, s, 10);
    assert.equal(rate.ordersPerMinute, expectedOrders, `Mask ${mask} orders mismatch`);
    assert.equal(rate.yenPerMinute, expectedYenRate, `Mask ${mask} yen mismatch`);
    assert.equal(rate.bottleneck, expectedBottleneck, `Mask ${mask} bottleneck mismatch`);

    // Test with master_license (revenue = 15)
    const masterRate = calculateProductionRate(k, s, 15);
    assert.equal(masterRate.ordersPerMinute, expectedOrders);
    assert.equal(masterRate.yenPerMinute, expectedOrders * 15);
    assert.equal(masterRate.bottleneck, expectedBottleneck);
  }

  // Canonical Progression Steps verification
  const canonicalSteps = [
    { desc: 'Start (Base)', k: 1, s: 2, a: 10, o: 1, r: 10, bottleneck: 'kitchen' },
    { desc: 'Ch 6 Bronze (prep_counter)', k: 3, s: 2, a: 10, o: 2, r: 20, bottleneck: 'service' },
    { desc: 'Ch 8 Bronze (precision_knife)', k: 4, s: 2, a: 10, o: 2, r: 20, bottleneck: 'service' },
    { desc: 'Ch 9 Bronze (conveyor_belt)', k: 4, s: 4, a: 10, o: 4, r: 40, bottleneck: 'none' },
    { desc: 'Ch 10 Bronze (service_counter)', k: 4, s: 6, a: 10, o: 4, r: 40, bottleneck: 'kitchen' },
    { desc: 'Ch 11 Bronze (sous_chef)', k: 6, s: 6, a: 10, o: 6, r: 60, bottleneck: 'none' },
    { desc: 'Ch 12 Bronze (master_license)', k: 6, s: 6, a: 15, o: 6, r: 90, bottleneck: 'none' },
  ];

  for (const step of canonicalSteps) {
    const rate = calculateProductionRate(step.k, step.s, step.a);
    assert.equal(rate.ordersPerMinute, step.o, `${step.desc} ordersPerMinute`);
    assert.equal(rate.yenPerMinute, step.r, `${step.desc} yenPerMinute`);
    assert.equal(rate.bottleneck, step.bottleneck, `${step.desc} bottleneck`);
  }

  // Boundary and adversarial rate calculations
  assert.equal(calculateProductionRate(-5, 4, 10).ordersPerMinute, 0, 'Negative K clamps to 0');
  assert.equal(calculateProductionRate(4, -5, 10).ordersPerMinute, 0, 'Negative S clamps to 0');
  assert.equal(calculateProductionRate(4, 4, -10).yenPerMinute, 0, 'Negative A clamps to 0');
  assert.equal(calculateProductionRate(0, 0, 10).bottleneck, 'none', '0/0 is balanced none');
  assert.equal(calculateProductionRate(0, 5, 10).bottleneck, 'kitchen', '0 kitchen is kitchen bottleneck');
  assert.equal(calculateProductionRate(5, 0, 10).bottleneck, 'service', '0 service is service bottleneck');
});

// =============================================================================
// CHALLENGE 4: CURRICULUM PROGRESSION SIMULATION (CHAPTERS 6 TO 12)
// =============================================================================

test('M3-CHALLENGE-04: Full Curriculum Lifecycle Simulation (Chapters 6 to 12)', () => {
  const courseProgress = createFreshCourseProgress();
  let cumulativeGrants: string[] = [];

  const chapterMilestones = [
    { chapter: 6, weekId: 'week-1', bronze: 'prep_counter', silver: 'salmon_nigiri', gold: 'paper_lantern' },
    { chapter: 7, weekId: 'week-2', bronze: 'cap_extension_12h', silver: 'kappamaki', gold: 'potted_plant' },
    { chapter: 8, weekId: 'week-3', bronze: 'precision_knife', silver: 'maguro_nigiri', gold: 'noren_curtain' },
    { chapter: 9, weekId: 'week-4', bronze: 'conveyor_belt', silver: 'ebi_nigiri', gold: 'wave_print' },
    { chapter: 10, weekId: 'week-5', bronze: 'service_counter', silver: 'tamago_nigiri', gold: 'andon_lantern' },
    { chapter: 11, weekId: 'week-6', bronze: 'sous_chef', silver: 'sashimi_plate', gold: 'sakura_bonsai' },
    { chapter: 12, weekId: 'week-7', bronze: 'master_license', silver: 'omakase_menu', gold: 'golden_maneki_neko' },
  ];

  let expectedTotal = 0;

  for (const m of chapterMilestones) {
    const week = getCourseWeekById(m.weekId);

    // 1. Bronze (60%)
    setWeekMasteryRatio(courseProgress, week, 0.65);
    let grants = evaluateMedalGrants(courseProgress, courseWeeks);
    expectedTotal += 1;
    assert.equal(grants.length, expectedTotal, `Ch ${m.chapter} bronze count`);
    assert.ok(grants.includes(m.bronze as UnlockGrantId), `Must unlock ${m.bronze}`);
    assert.ok(!grants.includes(m.silver as UnlockGrantId), `Silver ${m.silver} not yet unlocked`);
    assert.ok(!grants.includes(m.gold as UnlockGrantId), `Gold ${m.gold} not yet unlocked`);

    // Merge into cumulative
    cumulativeGrants = mergePermanentGrants(cumulativeGrants, grants);
    assert.equal(cumulativeGrants.length, expectedTotal);

    // 2. Silver (80%)
    setWeekMasteryRatio(courseProgress, week, 0.85);
    grants = evaluateMedalGrants(courseProgress, courseWeeks);
    expectedTotal += 1;
    assert.equal(grants.length, expectedTotal, `Ch ${m.chapter} silver count`);
    assert.ok(grants.includes(m.bronze as UnlockGrantId));
    assert.ok(grants.includes(m.silver as UnlockGrantId));
    assert.ok(!grants.includes(m.gold as UnlockGrantId));

    cumulativeGrants = mergePermanentGrants(cumulativeGrants, grants);
    assert.equal(cumulativeGrants.length, expectedTotal);

    // 3. Gold (100%)
    setWeekMasteryRatio(courseProgress, week, 1.0);
    grants = evaluateMedalGrants(courseProgress, courseWeeks);
    expectedTotal += 1;
    assert.equal(grants.length, expectedTotal, `Ch ${m.chapter} gold count`);
    assert.ok(grants.includes(m.bronze as UnlockGrantId));
    assert.ok(grants.includes(m.silver as UnlockGrantId));
    assert.ok(grants.includes(m.gold as UnlockGrantId));

    cumulativeGrants = mergePermanentGrants(cumulativeGrants, grants);
    assert.equal(cumulativeGrants.length, expectedTotal);
  }

  // All 21 items should now be earned
  assert.equal(cumulativeGrants.length, 21, 'All 21 canonical grants must be present');
  for (const item of SUSHI_CATALOG) {
    assert.ok(cumulativeGrants.includes(item.id), `Grant ${item.id} must be in final grants`);
  }

  // Adversarial: 100% Course Progress Wipeout / Severe Drop
  const wipedProgress = createFreshCourseProgress();
  const wipedEvaluated = evaluateMedalGrants(wipedProgress, courseWeeks);
  assert.equal(wipedEvaluated.length, 0, 'Wiped progress evaluates to 0 newly earned grants');

  // Monotonic preservation
  const preservedGrants = mergePermanentGrants(cumulativeGrants, wipedEvaluated);
  assert.equal(
    preservedGrants.length,
    21,
    'Previously earned grants must NEVER be revoked on course wipe',
  );

  // Adversarial: Non-linear study order (Student studies Chapter 12 first)
  const freshProgress = createFreshCourseProgress();
  const week7 = getCourseWeekById('week-7'); // Chapter 12
  setWeekMasteryRatio(freshProgress, week7, 1.0);

  const nonLinearGrants = evaluateMedalGrants(freshProgress, courseWeeks);
  assert.equal(nonLinearGrants.length, 3, 'Only Chapter 12 grants should be awarded');
  assert.ok(nonLinearGrants.includes('master_license'));
  assert.ok(nonLinearGrants.includes('omakase_menu'));
  assert.ok(nonLinearGrants.includes('golden_maneki_neko'));
  // Ensure earlier chapters remain strictly locked
  assert.ok(!nonLinearGrants.includes('prep_counter'));
  assert.ok(!nonLinearGrants.includes('precision_knife'));
  assert.ok(!nonLinearGrants.includes('conveyor_belt'));
});

// =============================================================================
// CHALLENGE 5: PURCHASE TRANSACTION LIFECYCLE & INTEGRITY
// =============================================================================

test('M3-CHALLENGE-05: End-to-End Purchase Transaction Stress & Boundary Invariance', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'purchase-stress-student';
  let nowMs = 1_700_000_000_000;

  // Initialize restaurant with ample funds (100,000 Yen = 6,000,000,000 units)
  const initState = await service.getOrInitRestaurant(uid, nowMs);
  assert.ok(initState && initState.id === uid);
  initState.balanceUnits = 100_000 * YEN_UNIT_MULTIPLIER;
  await repo.set(initState);

  // 1. Attempt purchasing locked item before grants are synced
  const lockedBuy = await service.purchaseCatalogItem(uid, 'master_license', 'tx-locked-01', nowMs);
  assert.equal(lockedBuy.success, false);
  assert.equal(lockedBuy.reason, 'ITEM_LOCKED');

  // 2. Sync all 21 grants
  const allGrantIds = SUSHI_CATALOG.map((i) => i.id);
  const syncedState = await service.syncMedalGrants(uid, allGrantIds, nowMs);
  assert.ok(syncedState && syncedState.id === uid);
  assert.equal(syncedState.permanentGrants.length, 21);

  // 3. Purchase all 21 items in sequence and verify accounting
  let expectedBalance = 100_000 * YEN_UNIT_MULTIPLIER;
  let expectedK = 1;
  let expectedS = 2;
  let expectedA = 10;
  let expectedCap = DEFAULT_CAP_MS;

  for (let idx = 0; idx < SUSHI_CATALOG.length; idx++) {
    const item = SUSHI_CATALOG[idx];
    nowMs += 1000;

    const buyRes = await service.purchaseCatalogItem(uid, item.id, `tx-buy-${item.id}`, nowMs);
    assert.ok(buyRes.success, `Purchase of ${item.id} must succeed`);
    assert.equal(buyRes.debitedUnits, item.priceUnits, `${item.id} debited units`);

    expectedBalance -= item.priceUnits;
    if (item.kitchenCapacityDelta) expectedK += item.kitchenCapacityDelta;
    if (item.serviceCapacityDelta) expectedS += item.serviceCapacityDelta;
    if (item.averageRevenueDelta) expectedA += item.averageRevenueDelta;
    if (item.newCapMs) expectedCap = item.newCapMs;

    assert.equal(buyRes.state.balanceUnits, expectedBalance, `Balance after ${item.id}`);
    assert.equal(buyRes.state.kitchenCapacity, expectedK, `Kitchen after ${item.id}`);
    assert.equal(buyRes.state.serviceCapacity, expectedS, `Service after ${item.id}`);
    assert.equal(buyRes.state.averageRevenuePerOrder, expectedA, `AvgRev after ${item.id}`);
    assert.equal(buyRes.state.capMs, expectedCap, `Cap after ${item.id}`);
    assert.ok(buyRes.state.inventory.includes(item.id), `Inventory must contain ${item.id}`);

    // Idempotent replay with same idempotencyKey
    const replayRes = await service.purchaseCatalogItem(uid, item.id, `tx-buy-${item.id}`, nowMs);
    assert.ok(replayRes.success, 'Replay with same key must return success');
    assert.equal(replayRes.wasAlreadyProcessed, true, 'Replay must indicate wasAlreadyProcessed');
    assert.equal(replayRes.state.balanceUnits, expectedBalance, 'Replay must not debit funds');

    // Duplicate purchase attempt with new key must fail ALREADY_OWNED
    const dupRes = await service.purchaseCatalogItem(uid, item.id, `tx-dup-${item.id}`, nowMs);
    assert.equal(dupRes.success, false);
    assert.equal(dupRes.reason, 'ALREADY_OWNED');
  }

  // Final restaurant verification
  assert.equal(expectedK, 6, 'Final kitchen capacity must be 6');
  assert.equal(expectedS, 6, 'Final service capacity must be 6');
  assert.equal(expectedA, 15, 'Final average revenue must be 15');
  assert.equal(expectedCap, EXTENDED_CAP_MS, 'Final cap must be 12 hours');
  assert.equal(
    expectedBalance,
    (100_000 - 48_000) * YEN_UNIT_MULTIPLIER,
    'Exactly 48,000 Yen spent',
  );

  // Final rate verification: K=6, S=6, A=15 -> 6 * 15 = 90 Yen/min
  const finalRate = calculateProductionRate(expectedK, expectedS, expectedA);
  assert.equal(finalRate.ordersPerMinute, 6);
  assert.equal(finalRate.yenPerMinute, 90);
  assert.equal(finalRate.bottleneck, 'none');

  // Boundary condition: insufficient funds by exactly 1 unit
  const poorStudentUid = 'poor-student';
  const poorInit = await service.getOrInitRestaurant(poorStudentUid, nowMs);
  poorInit.permanentGrants = ['prep_counter'];
  poorInit.balanceUnits = 300 * YEN_UNIT_MULTIPLIER - 1; // 1 unit short of 300 yen
  await repo.set(poorInit);

  const poorBuy = await service.purchaseCatalogItem(poorStudentUid, 'prep_counter', 'poor-tx-1', nowMs);
  assert.equal(poorBuy.success, false);
  assert.equal(poorBuy.reason, 'INSUFFICIENT_FUNDS');
});

// =============================================================================
// CHALLENGE 6: EDGE CASE MINING: INVALID INPUTS, UNKNOWN IDS & SCENE RENDERING
// =============================================================================

test('M3-CHALLENGE-06: Edge Case Mining: Invalid Inputs, Unknown IDs & Scene Rendering', () => {
  // 1. Unknown catalog lookups
  assert.equal(getCatalogItem('unknown_item_xyz'), undefined);
  assert.equal(isCatalogItem('unknown_item_xyz'), false);
  assert.equal(previewCatalogPurchase(createMockRestaurant(), 'non_existent_item'), undefined);

  // 2. Affordance boundary checks
  const priceYen = 1000;
  const priceUnits = 1000 * YEN_UNIT_MULTIPLIER;
  assert.equal(canAfford(priceUnits - 1, priceYen), false, '1 unit short cannot afford');
  assert.equal(canAfford(priceUnits, priceYen), true, 'Exact units can afford');
  assert.equal(canAfford(priceUnits + 1, priceYen), true, '1 unit over can afford');
  assert.equal(canAfford(0, 0), true, '0 units can afford 0 yen');
  assert.equal(canAfford(-100, 0), false, 'Negative units cannot afford');

  // 3. unitsToWholeYen and unitsToYenDecimal
  assert.equal(unitsToWholeYen(0), 0);
  assert.equal(unitsToWholeYen(-5000), 0, 'Negative units round to 0 whole yen');
  assert.equal(unitsToWholeYen(59_999), 0, '59,999 units rounds down to 0 yen');
  assert.equal(unitsToWholeYen(60_000), 1, '60,000 units is 1 yen');
  assert.equal(unitsToWholeYen(119_999), 1, '119,999 units rounds down to 1 yen');
  assert.equal(unitsToWholeYen(120_000), 2, '120,000 units is 2 yen');

  // 4. tierSatisfies boundary checks
  assert.equal(tierSatisfies(undefined, 'bronze'), false);
  assert.equal(tierSatisfies(null, 'bronze'), false);
  assert.equal(tierSatisfies('bronze', 'bronze'), true);
  assert.equal(tierSatisfies('bronze', 'silver'), false);
  assert.equal(tierSatisfies('bronze', 'gold'), false);
  assert.equal(tierSatisfies('silver', 'bronze'), true);
  assert.equal(tierSatisfies('silver', 'silver'), true);
  assert.equal(tierSatisfies('silver', 'gold'), false);
  assert.equal(tierSatisfies('gold', 'bronze'), true);
  assert.equal(tierSatisfies('gold', 'silver'), true);
  assert.equal(tierSatisfies('gold', 'gold'), true);

  // 5. mergePermanentGrants input sanitization
  assert.deepEqual(mergePermanentGrants(undefined, undefined), []);
  assert.deepEqual(mergePermanentGrants([] as any, [] as any), []);
  assert.deepEqual(
    mergePermanentGrants(['  prep_counter  ', ''], ['prep_counter', '   ', 'salmon_nigiri']),
    ['prep_counter', 'salmon_nigiri'],
  );
  assert.deepEqual(
    mergePermanentGrants(['a', 'b', 'c'], ['b', 'c', 'd']),
    ['a', 'b', 'c', 'd'],
  );

  // 6. Extreme timestamp accrual (10 years elapsed)
  const base = createInitialEconomyState(1_000_000);
  const tenYearsMs = 10 * 365 * 24 * 3600 * 1000;
  const extremeAccrual = calculateAccrual(base, 1_000_000 + tenYearsMs);
  assert.ok(extremeAccrual.producedMs <= DEFAULT_CAP_MS, 'Produced time strictly clamped to 8h cap');
  assert.equal(extremeAccrual.producedMs, DEFAULT_CAP_MS);
  assert.equal(extremeAccrual.earnedUnits, 10 * DEFAULT_CAP_MS);
  assert.ok(extremeAccrual.excessMs > 0, 'Excess time accounted for');
});

