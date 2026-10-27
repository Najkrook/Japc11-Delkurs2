import {
  createLegacyEconomyState,
  LEGACY_CAP_MS,
  LEGACY_EXTENDED_CAP_MS,
} from './helpers/legacy-sushi-economy.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProductionRate,
  calculateAccrual,
  collectEarnings,
  applyProspectiveUpgrade,
  unitsToWholeYen,
  unitsToYenDecimal,
  yenToUnits,
  canAfford,
} from '../src/course/sushi-game/economy.ts';
import { YEN_UNIT_MULTIPLIER, MS_PER_HOUR, MS_PER_MINUTE } from '../src/course/sushi-game/types.ts';

// -----------------------------------------------------------------------------
// T01: Two-Capacity Rate Formula & Bottlenecks
// -----------------------------------------------------------------------------
test('T01: calculateProductionRate calculates min(kitchen, service) and identifies bottleneck', () => {
  // Base restaurant: Kitchen 1, Service 2, AvgRev 10 -> Rate 10 yen/min, Kitchen bottleneck
  const r1 = calculateProductionRate(1, 2, 10);
  assert.equal(r1.ordersPerMinute, 1);
  assert.equal(r1.yenPerMinute, 10);
  assert.equal(r1.bottleneck, 'kitchen');

  // After Prep Counter: Kitchen 3, Service 2, AvgRev 10 -> Rate 20 yen/min, Service bottleneck
  const r2 = calculateProductionRate(3, 2, 10);
  assert.equal(r2.ordersPerMinute, 2);
  assert.equal(r2.yenPerMinute, 20);
  assert.equal(r2.bottleneck, 'service');

  // After Conveyor Belt: Kitchen 3, Service 4, AvgRev 10 -> Rate 30 yen/min, Kitchen bottleneck
  const r3 = calculateProductionRate(3, 4, 10);
  assert.equal(r3.ordersPerMinute, 3);
  assert.equal(r3.yenPerMinute, 30);
  assert.equal(r3.bottleneck, 'kitchen');

  // Balanced: Kitchen 4, Service 4 -> Rate 40 yen/min, None bottleneck
  const r4 = calculateProductionRate(4, 4, 10);
  assert.equal(r4.ordersPerMinute, 4);
  assert.equal(r4.yenPerMinute, 40);
  assert.equal(r4.bottleneck, 'none');
});

// -----------------------------------------------------------------------------
// T02: Accrual with 0 ms elapsed
// -----------------------------------------------------------------------------
test('T02: calculateAccrual with 0 ms elapsed yields 0 produced ms and zero earnings', () => {
  const state = createLegacyEconomyState(1_000_000);
  const result = calculateAccrual(state, 1_000_000);

  assert.equal(result.elapsedMs, 0);
  assert.equal(result.producedMs, 0);
  assert.equal(result.earnedUnits, 0);
  assert.equal(result.updatedState.uncollectedUnits, 0);
  assert.equal(result.updatedState.usedProductionMs, 0);
  assert.equal(result.updatedState.accountedAtMs, 1_000_000);
  assert.equal(result.isCapped, false);
});

// -----------------------------------------------------------------------------
// T03: Clock Drift / Backward Timestamp Anomaly
// -----------------------------------------------------------------------------
test('T03: calculateAccrual clamps backward clock drift safely', () => {
  const state = createLegacyEconomyState(5_000_000);
  // nowMs is before accountedAtMs
  const result = calculateAccrual(state, 4_900_000);

  assert.equal(result.elapsedMs, 0);
  assert.equal(result.producedMs, 0);
  assert.equal(result.earnedUnits, 0);
  assert.equal(result.updatedState.accountedAtMs, 5_000_000); // Does not rewind
});

// -----------------------------------------------------------------------------
// T04: Partial minute & millisecond unit precision
// -----------------------------------------------------------------------------
test('T04: calculateAccrual handles partial minutes with exact 1/60000th unit math', () => {
  const state = createLegacyEconomyState(0); // 10 yen/min = 10 units/ms

  // 1 ms elapsed
  const r1 = calculateAccrual(state, 1);
  assert.equal(r1.producedMs, 1);
  assert.equal(r1.earnedUnits, 10);
  assert.equal(unitsToWholeYen(r1.earnedUnits), 0);

  // 500 ms elapsed
  const r500 = calculateAccrual(state, 500);
  assert.equal(r500.producedMs, 500);
  assert.equal(r500.earnedUnits, 5000);
  assert.equal(unitsToWholeYen(r500.earnedUnits), 0);

  // 30,000 ms (30 sec) elapsed -> 300,000 units = exactly 5 yen
  const r30s = calculateAccrual(state, 30_000);
  assert.equal(r30s.producedMs, 30_000);
  assert.equal(r30s.earnedUnits, 300_000);
  assert.equal(unitsToWholeYen(r30s.earnedUnits), 5);
});

// -----------------------------------------------------------------------------
// T05: Exact 1 minute elapsed
// -----------------------------------------------------------------------------
test('T05: calculateAccrual for exact 1 minute produces exactly yenPerMinute in whole yen', () => {
  const state = createLegacyEconomyState(0);
  const result = calculateAccrual(state, MS_PER_MINUTE);

  assert.equal(result.producedMs, 60_000);
  assert.equal(result.earnedUnits, 600_000); // 10 * 60,000
  assert.equal(unitsToWholeYen(result.earnedUnits), 10);
});

// -----------------------------------------------------------------------------
// T06: 30 minutes elapsed (First Purchase Prelude)
// -----------------------------------------------------------------------------
test('T06: calculateAccrual for 30 minutes at base rate yields 300 yen (18,000,000 units)', () => {
  const state = createLegacyEconomyState(0);
  const result = calculateAccrual(state, 30 * MS_PER_MINUTE);

  assert.equal(result.producedMs, 1_800_000);
  assert.equal(result.earnedUnits, 18_000_000);
  assert.equal(unitsToWholeYen(result.earnedUnits), 300);
});

// -----------------------------------------------------------------------------
// T07: Exact 8-hour cap reached
// -----------------------------------------------------------------------------
test('T07: calculateAccrual reaches exact 8-hour cap at 28,800,000 ms', () => {
  const state = createLegacyEconomyState(0);
  const result = calculateAccrual(state, LEGACY_CAP_MS);

  assert.equal(result.producedMs, 28_800_000);
  assert.equal(result.excessMs, 0);
  assert.equal(result.isCapped, true);
  assert.equal(result.remainingCapMs, 0);
  assert.equal(result.earnedUnits, 288_000_000); // 480 min * 10 yen * 60,000 = 288,000,000
  assert.equal(unitsToWholeYen(result.earnedUnits), 4800);
  assert.equal(result.updatedState.usedProductionMs, LEGACY_CAP_MS);
});

// -----------------------------------------------------------------------------
// T08: 9 hours elapsed (1 hour excess discarded)
// -----------------------------------------------------------------------------
test('T08: calculateAccrual for 9 hours discards 1 hour excess and keeps cap at 8h', () => {
  const state = createLegacyEconomyState(0);
  const nineHoursMs = 9 * MS_PER_HOUR;
  const result = calculateAccrual(state, nineHoursMs);

  assert.equal(result.elapsedMs, 32_400_000);
  assert.equal(result.producedMs, 28_800_000);
  assert.equal(result.excessMs, 3_600_000); // Exactly 1 hour discarded
  assert.equal(result.isCapped, true);
  assert.equal(result.earnedUnits, 288_000_000);
  assert.equal(unitsToWholeYen(result.earnedUnits), 4800);
  assert.equal(result.updatedState.usedProductionMs, LEGACY_CAP_MS);
  assert.equal(result.updatedState.accountedAtMs, nineHoursMs);
});

// -----------------------------------------------------------------------------
// T09: 72 hours long absence
// -----------------------------------------------------------------------------
test('T09: calculateAccrual for 72 hours absence caps at 4,800 yen and discards 64 hours', () => {
  const state = createLegacyEconomyState(0);
  const seventyTwoHoursMs = 72 * MS_PER_HOUR;
  const result = calculateAccrual(state, seventyTwoHoursMs);

  assert.equal(result.producedMs, LEGACY_CAP_MS);
  assert.equal(result.excessMs, 64 * MS_PER_HOUR);
  assert.equal(unitsToWholeYen(result.earnedUnits), 4800);
  assert.equal(result.updatedState.usedProductionMs, LEGACY_CAP_MS);
  assert.equal(result.updatedState.accountedAtMs, seventyTwoHoursMs);
});

// -----------------------------------------------------------------------------
// T10: Manual Collection flushes uncollected to spendable balance
// -----------------------------------------------------------------------------
test('T10: collectEarnings transfers pending units to balanceUnits and resets timers', () => {
  const state = createLegacyEconomyState(0);
  const after30m = 30 * MS_PER_MINUTE; // 300 yen pending

  const collection = collectEarnings(state, after30m);

  assert.equal(collection.transferredUnits, 18_000_000);
  assert.equal(collection.transferredYenWhole, 300);
  assert.equal(collection.newBalanceUnits, 18_000_000);
  assert.equal(collection.updatedState.uncollectedUnits, 0);
  assert.equal(collection.updatedState.usedProductionMs, 0);
  assert.equal(collection.updatedState.accountedAtMs, after30m);
  assert.equal(collection.updatedState.periodStartMs, after30m);
});

// -----------------------------------------------------------------------------
// T11: Idempotent Collection at 0 pending revenue
// -----------------------------------------------------------------------------
test('T11: collectEarnings on empty register is safe and idempotent', () => {
  const state = createLegacyEconomyState(1_000_000, {
    balanceUnits: 50_000_000,
    uncollectedUnits: 0,
  });

  const collection = collectEarnings(state, 1_000_000);

  assert.equal(collection.transferredUnits, 0);
  assert.equal(collection.newBalanceUnits, 50_000_000);
  assert.equal(collection.updatedState.balanceUnits, 50_000_000);
  assert.equal(collection.updatedState.uncollectedUnits, 0);
});

// -----------------------------------------------------------------------------
// T12: Fractional preservation across 6,000 collections vs single collection
// -----------------------------------------------------------------------------
test('T12: 6,000 split 1 ms accrual-collections preserve exact fractional units (zero drift)', () => {
  let state = createLegacyEconomyState(0); // 10 yen/min = 10 units/ms

  // Perform 6,000 steps of 1 ms accrual and collect
  for (let i = 1; i <= 6000; i++) {
    const col = collectEarnings(state, i);
    state = col.updatedState;
  }

  // Exactly 6,000 * 10 units = 60,000 units = exactly 1 whole yen
  assert.equal(state.balanceUnits, 60_000);
  assert.equal(unitsToWholeYen(state.balanceUnits), 1);
  assert.equal(state.uncollectedUnits, 0);

  // Compare with a single 6,000 ms accrual and collect
  const singleState = createLegacyEconomyState(0);
  const singleCol = collectEarnings(singleState, 6000);
  assert.equal(singleCol.newBalanceUnits, 60_000);
  assert.equal(state.balanceUnits, singleCol.newBalanceUnits); // Exactly identical!
});

// -----------------------------------------------------------------------------
// T13: Section 5.7 Scenario 2: Ordinary Mid-Period Rate Upgrade
// -----------------------------------------------------------------------------
test('T13: Section 5.7 Scenario 2 - Mid-period rate upgrade applies prospectively', () => {
  // Start with 10,000 yen spendable = 600,000,000 units
  let state = createLegacyEconomyState(0, {
    balanceUnits: yenToUnits(10_000),
  });

  // At T=02:00 (120 min), pending is 1,200 yen (72,000,000 units)
  const t2h = 2 * MS_PER_HOUR;
  const upgradeResult = applyProspectiveUpgrade(state, t2h, {
    itemId: 'prep_counter_1',
    priceYen: 300,
    kitchenCapacityDelta: 2, // 1 -> 3; Rate becomes 20 yen/min
  });

  assert.equal(upgradeResult.success, true);
  if (!upgradeResult.success) return;

  state = upgradeResult.updatedState;
  // Spendable balance debited 300 yen -> 9,700 yen
  assert.equal(unitsToWholeYen(state.balanceUnits), 9700);
  assert.equal(state.balanceUnits, yenToUnits(9700));
  // Uncollected stays 1,200 yen
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 1200);
  // Used time is 2 hours
  assert.equal(state.usedProductionMs, 2 * MS_PER_HOUR);

  // At T=03:00 (1 hour at new rate of 20 yen/min = +1,200 yen)
  const t3h = 3 * MS_PER_HOUR;
  const accrual = calculateAccrual(state, t3h);
  state = accrual.updatedState;

  // Total pending: 1,200 + 1,200 = 2,400 yen
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 2400);
  assert.equal(state.usedProductionMs, 3 * MS_PER_HOUR);
  assert.equal(unitsToWholeYen(state.balanceUnits), 9700);
});

// -----------------------------------------------------------------------------
// T14: Section 5.7 Scenario 3: Collection after mid-period upgrade
// -----------------------------------------------------------------------------
test('T14: Section 5.7 Scenario 3 - Collection at T=03:00 after upgrade yields 12,100 yen', () => {
  // Continuing state from T13 at T=3h
  const state = createLegacyEconomyState(3 * MS_PER_HOUR, {
    balanceUnits: yenToUnits(9700),
    uncollectedUnits: yenToUnits(2400),
    usedProductionMs: 3 * MS_PER_HOUR,
    kitchenCapacity: 3,
    serviceCapacity: 2, // 20 yen/min
  });

  const col = collectEarnings(state, 3 * MS_PER_HOUR);
  assert.equal(col.transferredYenWhole, 2400);
  assert.equal(unitsToWholeYen(col.newBalanceUnits), 12_100);
  assert.equal(col.updatedState.uncollectedUnits, 0);
  assert.equal(col.updatedState.usedProductionMs, 0);
  assert.equal(col.updatedState.capMs, LEGACY_CAP_MS);
});

// -----------------------------------------------------------------------------
// T15: Section 5.7 Scenario 4: Purchase at full register leaves production stopped
// -----------------------------------------------------------------------------
test('T15: Section 5.7 Scenario 4 - Purchase at full register leaves production stopped', () => {
  // Start with 10,000 yen spendable
  let state = createLegacyEconomyState(0, {
    balanceUnits: yenToUnits(10_000),
  });

  // At T=10:00 (10 hours elapsed on 8h cap):
  const t10h = 10 * MS_PER_HOUR;
  const upg = applyProspectiveUpgrade(state, t10h, {
    itemId: 'prep_counter_1',
    priceYen: 300,
    kitchenCapacityDelta: 2,
  });

  assert.equal(upg.success, true);
  if (!upg.success) return;

  state = upg.updatedState;
  assert.equal(unitsToWholeYen(state.balanceUnits), 9700);
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 4800); // 8h productive time
  assert.equal(state.usedProductionMs, LEGACY_CAP_MS); // Exactly 8h used

  // Verify production remains stopped
  const t11h = 11 * MS_PER_HOUR;
  const acc = calculateAccrual(state, t11h);
  assert.equal(acc.producedMs, 0);
  assert.equal(acc.excessMs, MS_PER_HOUR);
  assert.equal(acc.isCapped, true);
  assert.equal(unitsToWholeYen(acc.updatedState.uncollectedUnits), 4800);
});

// -----------------------------------------------------------------------------
// T16: Section 5.7 Scenario 5: Cap upgrade at full register grants 4 future hours
// -----------------------------------------------------------------------------
test('T16: Section 5.7 Scenario 5 - Cap upgrade on full register grants 4 future hours from purchase', () => {
  // Continuing from T15 at T=10:00:
  // balance: 9,700 yen; uncollected: 4,800 yen; usedMs: 8h; kitchen: 3; service: 2 (rate 20 yen/min)
  let state = createLegacyEconomyState(10 * MS_PER_HOUR, {
    balanceUnits: yenToUnits(9700),
    uncollectedUnits: yenToUnits(4800),
    usedProductionMs: LEGACY_CAP_MS, // 8h
    kitchenCapacity: 3,
    serviceCapacity: 2,
    capMs: LEGACY_CAP_MS,
  });

  // Buy Cap Upgrade (1,800 yen) at T=10:00
  const t10h = 10 * MS_PER_HOUR;
  const upg = applyProspectiveUpgrade(state, t10h, {
    itemId: 'cap_extension_1',
    priceYen: 1800,
    newCapMs: LEGACY_EXTENDED_CAP_MS, // 12h
  });

  assert.equal(upg.success, true);
  if (!upg.success) return;

  state = upg.updatedState;
  assert.equal(unitsToWholeYen(state.balanceUnits), 7900); // 9,700 - 1,800
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 4800); // Preserved
  assert.equal(state.usedProductionMs, LEGACY_CAP_MS); // Still 8h used
  assert.equal(state.capMs, LEGACY_EXTENDED_CAP_MS); // New cap: 12h

  // At T=11:00 (1 hour after purchase at 20 yen/min = +1,200 yen)
  const t11h = 11 * MS_PER_HOUR;
  const acc11 = calculateAccrual(state, t11h);
  assert.equal(unitsToWholeYen(acc11.updatedState.uncollectedUnits), 6000); // 4,800 + 1,200
  assert.equal(acc11.updatedState.usedProductionMs, 9 * MS_PER_HOUR);

  // At T=14:00 (4 hours after purchase at 20 yen/min = +4,800 yen)
  const t14h = 14 * MS_PER_HOUR;
  const acc14 = calculateAccrual(state, t14h);
  assert.equal(unitsToWholeYen(acc14.updatedState.uncollectedUnits), 9600); // 4,800 + 4,800
  assert.equal(acc14.updatedState.usedProductionMs, 12 * MS_PER_HOUR); // Cap reached!
  assert.equal(acc14.isCapped, true);

  // At T=15:00 (stopped; no further income)
  const t15h = 15 * MS_PER_HOUR;
  const acc15 = calculateAccrual(state, t15h);
  assert.equal(unitsToWholeYen(acc15.updatedState.uncollectedUnits), 9600);
});

// -----------------------------------------------------------------------------
// T17: Section 5.7 Scenario 6: Collection on 12-hour cap
// -----------------------------------------------------------------------------
test('T17: Section 5.7 Scenario 6 - Subsequent collection on 12-hour cap transfers 9,600 yen', () => {
  const state = createLegacyEconomyState(14 * MS_PER_HOUR, {
    balanceUnits: yenToUnits(7900),
    uncollectedUnits: yenToUnits(9600),
    usedProductionMs: LEGACY_EXTENDED_CAP_MS,
    capMs: LEGACY_EXTENDED_CAP_MS,
    kitchenCapacity: 3,
    serviceCapacity: 2,
  });

  const col = collectEarnings(state, 14 * MS_PER_HOUR);
  assert.equal(col.transferredYenWhole, 9600);
  assert.equal(unitsToWholeYen(col.newBalanceUnits), 17_500); // 7,900 + 9,600
  assert.equal(col.updatedState.uncollectedUnits, 0);
  assert.equal(col.updatedState.usedProductionMs, 0);
  assert.equal(col.updatedState.capMs, LEGACY_EXTENDED_CAP_MS); // Cap remains 12h
});

// -----------------------------------------------------------------------------
// T18: Section 5.7 Scenario 7: Cap purchase before old limit
// -----------------------------------------------------------------------------
test('T18: Section 5.7 Scenario 7 - Cap purchase at T=02:00 yields 10 remaining production hours', () => {
  let state = createLegacyEconomyState(0, {
    balanceUnits: yenToUnits(10_000),
  });

  // At T=02:00, buy cap upgrade (1,800 yen)
  const t2h = 2 * MS_PER_HOUR;
  const upg = applyProspectiveUpgrade(state, t2h, {
    itemId: 'cap_extension_1',
    priceYen: 1800,
    newCapMs: LEGACY_EXTENDED_CAP_MS,
  });

  assert.equal(upg.success, true);
  if (!upg.success) return;

  state = upg.updatedState;
  assert.equal(unitsToWholeYen(state.balanceUnits), 8200);
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 1200);
  assert.equal(state.usedProductionMs, 2 * MS_PER_HOUR);

  // At T=12:00 (10 hours later at base 10 yen/min = +6,000 yen)
  const t12h = 12 * MS_PER_HOUR;
  const acc = calculateAccrual(state, t12h);
  assert.equal(unitsToWholeYen(acc.updatedState.uncollectedUnits), 7200); // 1,200 + 6,000
  assert.equal(acc.updatedState.usedProductionMs, 12 * MS_PER_HOUR);
  assert.equal(acc.isCapped, true);
});

// -----------------------------------------------------------------------------
// T19: Section 5.7 Scenario 8: Cap purchase exactly at old limit
// -----------------------------------------------------------------------------
test('T19: Section 5.7 Scenario 8 - Cap purchase at T=08:00 grants 4 future hours to T=12:00', () => {
  let state = createLegacyEconomyState(0, {
    balanceUnits: yenToUnits(10_000),
  });

  // At T=08:00, buy cap upgrade (1,800 yen)
  const t8h = 8 * MS_PER_HOUR;
  const upg = applyProspectiveUpgrade(state, t8h, {
    itemId: 'cap_extension_1',
    priceYen: 1800,
    newCapMs: LEGACY_EXTENDED_CAP_MS,
  });

  assert.equal(upg.success, true);
  if (!upg.success) return;

  state = upg.updatedState;
  assert.equal(unitsToWholeYen(state.balanceUnits), 8200);
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 4800);
  assert.equal(state.usedProductionMs, 8 * MS_PER_HOUR);

  // At T=09:00: pending is 5,400 yen (4,800 + 600)
  const t9h = 9 * MS_PER_HOUR;
  const acc9 = calculateAccrual(state, t9h);
  assert.equal(unitsToWholeYen(acc9.updatedState.uncollectedUnits), 5400);

  // At T=12:00: pending reaches 7,200 yen and stops
  const t12h = 12 * MS_PER_HOUR;
  const acc12 = calculateAccrual(state, t12h);
  assert.equal(unitsToWholeYen(acc12.updatedState.uncollectedUnits), 7200);
  assert.equal(acc12.updatedState.usedProductionMs, 12 * MS_PER_HOUR);
  assert.equal(acc12.isCapped, true);
});

// -----------------------------------------------------------------------------
// T20: Conveyor Belt Bottleneck & Insufficient Funds Rejection
// -----------------------------------------------------------------------------
test('T20: Conveyor belt upgrade respects kitchen bottleneck; insufficient funds safely rejected', () => {
  // 1. Conveyor belt bought first: kitchen 1, service becomes 4 -> rate stays 10 yen/min!
  const state = createLegacyEconomyState(0, {
    balanceUnits: yenToUnits(5000),
  });

  const beltUpg = applyProspectiveUpgrade(state, 0, {
    itemId: 'conveyor_belt_1',
    priceYen: 3600,
    serviceCapacityDelta: 2, // 2 -> 4
  });

  assert.equal(beltUpg.success, true);
  if (!beltUpg.success) return;

  const upgraded = beltUpg.updatedState;
  assert.equal(upgraded.kitchenCapacity, 1);
  assert.equal(upgraded.serviceCapacity, 4);

  const rate = calculateProductionRate(
    upgraded.kitchenCapacity,
    upgraded.serviceCapacity,
    upgraded.averageRevenuePerOrder,
  );
  assert.equal(rate.ordersPerMinute, 1);
  assert.equal(rate.yenPerMinute, 10); // Rate remains 10 because kitchen is 1
  assert.equal(rate.bottleneck, 'kitchen');

  // 2. Insufficient funds rejected
  const brokeState = createLegacyEconomyState(0, {
    balanceUnits: yenToUnits(100), // Only 100 yen
  });

  const failUpg = applyProspectiveUpgrade(brokeState, 0, {
    itemId: 'prep_counter_1',
    priceYen: 300,
    kitchenCapacityDelta: 2,
  });

  assert.equal(failUpg.success, false);
  if (!failUpg.success) {
    assert.equal(failUpg.reason, 'INSUFFICIENT_FUNDS');
    assert.equal(failUpg.requiredUnits, yenToUnits(300));
    assert.equal(failUpg.actualUnits, yenToUnits(100));
  }
});
