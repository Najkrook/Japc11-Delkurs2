import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccrual,
  collectEarnings,
  applyProspectiveUpgrade,
  createInitialEconomyState,
  yenToUnits,
  unitsToWholeYen,
} from '../src/course/sushi-game/economy.ts';
import {
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from '../src/course/sushi-game/types.ts';
import {
  mergePermanentGrants,
  evaluateMedalGrants,
} from '../src/course/sushi-game/medals.ts';
import {
  SushiService,
  InMemorySushiRepository,
} from '../src/course/sushi-game/service.ts';
import { getCatalogItem } from '../src/course/sushi-game/catalog.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';

// =============================================================================
// Tier 2: Boundary Value Analysis — Accrual Cap Boundaries & Temporal Drift
// =============================================================================

test('Tier 2 [F04]: Exact cap boundary conditions: T, T - 1ms, T + 1ms', () => {
  const t0 = 100_000_000;
  const state = createInitialEconomyState(t0); // 8h cap (28,800,000 ms), rate = 10 yen/min

  // 1. Exactly 1 ms before cap: 28,799,999 ms
  const tJustBefore = t0 + DEFAULT_CAP_MS - 1;
  const accBefore = calculateAccrual(state, tJustBefore);
  assert.equal(accBefore.elapsedMs, DEFAULT_CAP_MS - 1);
  assert.equal(accBefore.producedMs, DEFAULT_CAP_MS - 1);
  assert.equal(accBefore.excessMs, 0);
  assert.equal(accBefore.isCapped, false);
  assert.equal(accBefore.remainingCapMs, 1);

  // 2. Exactly on the cap boundary: 28,800,000 ms
  const tExactCap = t0 + DEFAULT_CAP_MS;
  const accExact = calculateAccrual(state, tExactCap);
  assert.equal(accExact.elapsedMs, DEFAULT_CAP_MS);
  assert.equal(accExact.producedMs, DEFAULT_CAP_MS);
  assert.equal(accExact.excessMs, 0);
  assert.equal(accExact.isCapped, true);
  assert.equal(accExact.remainingCapMs, 0);
  assert.equal(accExact.earnedUnits, DEFAULT_CAP_MS * 10); // 288,000,000 units = 4,800 yen
  assert.equal(unitsToWholeYen(accExact.earnedUnits), 4800);

  // 3. Exactly 1 ms past the cap boundary: 28,800,001 ms
  const tJustAfter = t0 + DEFAULT_CAP_MS + 1;
  const accAfter = calculateAccrual(state, tJustAfter);
  assert.equal(accAfter.elapsedMs, DEFAULT_CAP_MS + 1);
  assert.equal(accAfter.producedMs, DEFAULT_CAP_MS); // Clamped to 8 hours
  assert.equal(accAfter.excessMs, 1); // 1 ms discarded
  assert.equal(accAfter.isCapped, true);
  assert.equal(accAfter.remainingCapMs, 0);
  assert.equal(accAfter.earnedUnits, DEFAULT_CAP_MS * 10);
});

test('Tier 2 [F04]: Extreme offline absence (1 year / 31,536,000,000 ms) clamps safely without overflow', () => {
  const t0 = 0;
  const state = createInitialEconomyState(t0);

  const ONE_YEAR_MS = 365 * 24 * 3600 * 1000; // 31,536,000,000 ms
  const accrual = calculateAccrual(state, ONE_YEAR_MS);

  assert.equal(accrual.elapsedMs, ONE_YEAR_MS);
  assert.equal(accrual.producedMs, DEFAULT_CAP_MS);
  assert.equal(accrual.excessMs, ONE_YEAR_MS - DEFAULT_CAP_MS);
  assert.equal(accrual.isCapped, true);
  assert.equal(accrual.remainingCapMs, 0);
  assert.equal(unitsToWholeYen(accrual.earnedUnits), 4800);
  assert.equal(Number.isFinite(accrual.earnedUnits), true);
  assert.equal(Number.isNaN(accrual.earnedUnits), false);
});

test('Tier 2 [F15]: Temporal anomalies: Zero elapsed ms and backward clock skew', () => {
  const t0 = 50_000_000;
  const state = createInitialEconomyState(t0);

  // 1. Zero elapsed ms (nowMs === accountedAtMs)
  const zeroElapsed = calculateAccrual(state, t0);
  assert.equal(zeroElapsed.elapsedMs, 0);
  assert.equal(zeroElapsed.producedMs, 0);
  assert.equal(zeroElapsed.earnedUnits, 0);
  assert.equal(zeroElapsed.updatedState.accountedAtMs, t0);

  // 2. Backward clock skew (nowMs < accountedAtMs by 10 hours)
  const pastTimestamp = t0 - 10 * MS_PER_HOUR;
  const backwardAccrual = calculateAccrual(state, pastTimestamp);
  assert.equal(backwardAccrual.elapsedMs, 0);
  assert.equal(backwardAccrual.producedMs, 0);
  assert.equal(backwardAccrual.earnedUnits, 0);
  // Timestamp must never rewind
  assert.equal(backwardAccrual.updatedState.accountedAtMs, t0);
});

// =============================================================================
// Tier 2: Dynamic Cap Upgrades & Stopped Time Discard Rule
// =============================================================================

test('Tier 2 [F07]: Cap upgrade purchased while register is capped at 8h discards stopped time', () => {
  const t0 = 0;
  const initial = createInitialEconomyState(t0);

  // Capped at 8h, but user returns at 11h (3 hours spent stopped)
  const t11h = 11 * MS_PER_HOUR;
  const accruedAt11h = calculateAccrual(initial, t11h);
  assert.equal(accruedAt11h.isCapped, true);
  assert.equal(accruedAt11h.excessMs, 3 * MS_PER_HOUR); // 3h stopped time

  // Provide sufficient spendable funds to buy cap_extension_12h (1,800 yen)
  const stateWithFunds = {
    ...accruedAt11h.updatedState,
    balanceUnits: yenToUnits(2000),
  };

  // Apply prospective cap extension upgrade (newCapMs = 12h = 43,200,000 ms)
  const capUpgradeResult = applyProspectiveUpgrade(stateWithFunds, t11h, {
    newCapMs: EXTENDED_CAP_MS,
    priceYen: 1800,
  });

  assert.equal(capUpgradeResult.success, true);
  if (!capUpgradeResult.success) return;

  const upgradedState = capUpgradeResult.updatedState;
  assert.equal(upgradedState.capMs, EXTENDED_CAP_MS);
  // Stopped 3 hours must NOT be retrospectively paid: uncollectedUnits stays 4,800 yen
  assert.equal(unitsToWholeYen(upgradedState.uncollectedUnits), 4800);
  assert.equal(upgradedState.usedProductionMs, DEFAULT_CAP_MS); // 8h consumed

  // Additional 4 hours offline (t15h) accrues future production up to 12h limit
  const t15h = t11h + 4 * MS_PER_HOUR;
  const nextAccrual = calculateAccrual(upgradedState, t15h);

  assert.equal(nextAccrual.producedMs, 4 * MS_PER_HOUR);
  assert.equal(nextAccrual.isCapped, true); // Now reached 12h cap
  assert.equal(nextAccrual.remainingCapMs, 0);
  // 4 extra hours at 10 yen/min = 2,400 yen added
  assert.equal(unitsToWholeYen(nextAccrual.earnedUnits), 2400);
  // Total in register is 4,800 + 2,400 = 7,200 yen
  assert.equal(unitsToWholeYen(nextAccrual.updatedState.uncollectedUnits), 7200);
});

// =============================================================================
// Tier 2: Monotonic Non-Revocation & Course Resets
// =============================================================================

test('Tier 2 [F09]: mergePermanentGrants maintains strict set union and sanitizes input', () => {
  const existing = ['prep_counter', 'salmon_nigiri'];
  const newlyAwarded = ['salmon_nigiri', 'paper_lantern'];

  const merged = mergePermanentGrants(existing, newlyAwarded);
  assert.equal(merged.length, 3);
  assert.ok(merged.includes('prep_counter'));
  assert.ok(merged.includes('salmon_nigiri'));
  assert.ok(merged.includes('paper_lantern'));

  // Idempotency: G ∪ G === G
  assert.deepEqual(mergePermanentGrants(merged, merged), merged);

  // Empty new grants never revokes existing grants: G ∪ ∅ === G
  assert.deepEqual(mergePermanentGrants(merged, []), merged);

  // Sanitizes whitespace and invalid entries
  const dirty = ['  prep_counter  ', '', '   ', 'wave_print'];
  const sanitized = mergePermanentGrants(existing, dirty);
  assert.ok(sanitized.includes('wave_print'));
  assert.ok(!sanitized.includes(''));
});

test('Tier 2 [F09]: Course reset to 0% progress never revokes previously stored grants', () => {
  const existingGrants = ['prep_counter', 'salmon_nigiri', 'paper_lantern', 'cap_extension_12h'];

  // Student resets progress or deletes study data: course data is fresh with 0% completion
  const resetCourseProgress = createFreshCourseProgress();
  const freshlyDerivedGrants = evaluateMedalGrants(resetCourseProgress, courseWeeks);
  assert.deepEqual(freshlyDerivedGrants, []);

  // Monotonic union guarantees all existing grants survive intact
  const finalGrants = mergePermanentGrants(existingGrants, freshlyDerivedGrants);
  assert.deepEqual(finalGrants, existingGrants);
});

// =============================================================================
// Tier 2: Concurrency, Idempotency & Transactional Affordance
// =============================================================================

test('Tier 2 [F13]: Idempotent collection returns cached result on duplicate idempotencyKey', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'idempotent-student';
  const t0 = 0;

  await service.getOrInitRestaurant(uid, t0);

  // 1 hour elapsed -> 600 yen uncollected
  const t1h = MS_PER_HOUR;
  const key = 'collect:daily-test-key-1';

  // First collection request
  const firstRes = await service.collectRevenue(uid, key, t1h);
  assert.equal(firstRes.wasAlreadyProcessed, false);
  assert.equal(firstRes.collectedYen, 600);
  assert.equal(firstRes.state.balanceUnits, yenToUnits(600));

  // Second duplicate collection request with same key
  const secondRes = await service.collectRevenue(uid, key, t1h + 5000);
  assert.equal(secondRes.wasAlreadyProcessed, true);
  // Zero additional funds transferred
  assert.equal(secondRes.collectedUnits, 0);
  assert.equal(secondRes.collectedYen, 0);
  assert.equal(secondRes.state.balanceUnits, yenToUnits(600));
});

test('Tier 2 [F11]: Boundary Affordance: Exact balance succeeds, off-by-one unit fails', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'affordance-student';
  const t0 = 1000;

  // prep_counter costs 300 yen (18,000,000 units)
  const prepPriceUnits = 300 * 60_000;

  // Case A: Exact balance - 1 unit (17,999,999 units)
  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: prepPriceUnits - 1 },
    result: null,
  }));

  const failedRes = await service.purchaseCatalogItem(uid, 'prep_counter', 'key-underfunded');
  assert.equal(failedRes.success, false);
  if (!failedRes.success) {
    assert.equal(failedRes.reason, 'INSUFFICIENT_FUNDS');
    assert.equal(failedRes.requiredUnits, prepPriceUnits);
    assert.equal(failedRes.actualUnits, prepPriceUnits - 1);
  }

  // Case B: Exactly exact balance (18,000,000 units)
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: prepPriceUnits },
    result: null,
  }));

  const successRes = await service.purchaseCatalogItem(uid, 'prep_counter', 'key-exact-fund');
  assert.equal(successRes.success, true);
  if (successRes.success) {
    assert.equal(successRes.restaurant.balanceUnits, 0); // Exact 0 remaining
    assert.ok(successRes.restaurant.inventory.includes('prep_counter'));
  }

  // Case C: Repurchase attempt fails with ALREADY_OWNED
  const repurchaseRes = await service.purchaseCatalogItem(uid, 'prep_counter', 'key-repurchase');
  assert.equal(repurchaseRes.success, false);
  if (!repurchaseRes.success) {
    assert.equal(repurchaseRes.reason, 'ALREADY_OWNED');
  }
});
