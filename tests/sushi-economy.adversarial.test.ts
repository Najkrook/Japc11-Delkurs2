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
  createInitialEconomyState,
} from '../src/course/sushi-game/economy.ts';
import {
  YEN_UNIT_MULTIPLIER,
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from '../src/course/sushi-game/types.ts';
import type { SushiEconomyState } from '../src/course/sushi-game/types.ts';

// =============================================================================
// ADVERSARIAL TEST SUITE: MILESTONE 1 ECONOMY MATH ENGINE
// =============================================================================

// -----------------------------------------------------------------------------
// Dimension 1: Negative Elapsed Time & Regressive Timestamps (Clock Tamper)
// -----------------------------------------------------------------------------

test('ADV-01: calculateAccrual safely absorbs extreme backward clock jump (-100 years)', () => {
  const startMs = 1_700_000_000_000; // Realistic timestamp
  const state = createInitialEconomyState(startMs, {
    balanceUnits: 50_000,
    uncollectedUnits: 120_000,
    usedProductionMs: 1_000_000,
  });

  // 100 years in the past
  const pastMs = startMs - 100 * 365.25 * 24 * MS_PER_HOUR;
  const result = calculateAccrual(state, pastMs);

  assert.equal(result.elapsedMs, 0, 'Negative elapsed time must be clamped to 0');
  assert.equal(result.producedMs, 0, 'No time produced on negative delta');
  assert.equal(result.excessMs, 0, 'No excess time on negative delta');
  assert.equal(result.earnedUnits, 0, 'Zero units earned on negative delta');
  assert.equal(
    result.updatedState.uncollectedUnits,
    120_000,
    'Existing uncollected units untouched',
  );
  assert.equal(result.updatedState.usedProductionMs, 1_000_000, 'Used production time untouched');
  assert.equal(result.updatedState.accountedAtMs, startMs, 'AccountedAtMs must NOT rewind');
});

test('ADV-02: Rapid oscillating clock jitter does not corrupt state or grant free units', () => {
  let state = createInitialEconomyState(1_000_000);
  // Timestamps oscillating back and forth: forward, backward, forward, backward...
  const sequence = [
    1_000_000,
    900_000, // backward -100s
    1_005_000, // forward +5s from origin
    1_002_000, // backward -3s
    1_010_000, // forward +5s from last accounted (1_005_000)
    1_008_000, // backward -2s
    1_060_000, // forward +50s from 1_010_000 -> net 60,000 ms produced from origin
  ];

  for (const t of sequence) {
    const res = calculateAccrual(state, t);
    state = res.updatedState;
    assert.ok(state.accountedAtMs >= 1_000_000, 'AccountedAtMs must be monotonic non-decreasing');
  }

  assert.equal(state.accountedAtMs, 1_060_000);
  assert.equal(state.usedProductionMs, 60_000); // Exactly 60s productive time
  assert.equal(state.uncollectedUnits, 600_000); // 10 yen/min * 1 min = 600,000 units
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 10);
});

test('ADV-03: collectEarnings with backward clock retains existing funds and does not rewind', () => {
  const startMs = 5_000_000;
  const state = createInitialEconomyState(startMs, {
    balanceUnits: yenToUnits(100),
    uncollectedUnits: yenToUnits(50),
    usedProductionMs: 300_000,
  });

  // Attempt collection with backward timestamp
  const col = collectEarnings(state, startMs - 50_000);

  assert.equal(col.transferredUnits, yenToUnits(50));
  assert.equal(col.newBalanceUnits, yenToUnits(150));
  assert.equal(col.updatedState.uncollectedUnits, 0);
  assert.equal(col.updatedState.usedProductionMs, 0);
  assert.equal(col.updatedState.accountedAtMs, startMs, 'AccountedAtMs preserved against rewind');
});

// -----------------------------------------------------------------------------
// Dimension 2: Extreme Elapsed Time (Astronomical Absences)
// -----------------------------------------------------------------------------

test('ADV-04: Multi-century absence (1,000 years) strictly clamps to 8h cap without overflow', () => {
  const startMs = 1_000_000;
  const state = createInitialEconomyState(startMs);

  const oneThousandYearsMs = 1000 * 365.25 * 24 * MS_PER_HOUR;
  const endMs = startMs + oneThousandYearsMs;

  const res = calculateAccrual(state, endMs);

  assert.equal(res.elapsedMs, oneThousandYearsMs);
  assert.equal(res.producedMs, DEFAULT_CAP_MS, 'Produced ms capped exactly at 8 hours');
  assert.equal(res.excessMs, oneThousandYearsMs - DEFAULT_CAP_MS, 'Excess ms matches difference');
  assert.equal(res.isCapped, true);
  assert.equal(res.remainingCapMs, 0);
  // Base rate 10 yen/min for 8h = 480 min * 10 = 4,800 yen = 288,000,000 units
  assert.equal(res.earnedUnits, 288_000_000);
  assert.equal(unitsToWholeYen(res.earnedUnits), 4800);
  assert.equal(res.updatedState.usedProductionMs, DEFAULT_CAP_MS);
  assert.equal(res.updatedState.accountedAtMs, endMs);
  assert.ok(Number.isSafeInteger(res.earnedUnits));
  assert.ok(Number.isSafeInteger(res.updatedState.accountedAtMs));
});

test('ADV-05: Accrual after cap already reached produces exactly 0 units over subsequent years', () => {
  const state = createInitialEconomyState(0, {
    usedProductionMs: DEFAULT_CAP_MS,
    uncollectedUnits: 288_000_000,
    capMs: DEFAULT_CAP_MS,
  });

  const tenYearsMs = 10 * 365.25 * 24 * MS_PER_HOUR;
  const res = calculateAccrual(state, tenYearsMs);

  assert.equal(res.producedMs, 0);
  assert.equal(res.excessMs, tenYearsMs);
  assert.equal(res.earnedUnits, 0);
  assert.equal(res.isCapped, true);
  assert.equal(res.remainingCapMs, 0);
  assert.equal(res.updatedState.uncollectedUnits, 288_000_000);
  assert.equal(res.updatedState.usedProductionMs, DEFAULT_CAP_MS);
});

// -----------------------------------------------------------------------------
// Dimension 3: Sub-millisecond & Fractional Values
// -----------------------------------------------------------------------------

test('ADV-06: Sub-millisecond deltas and fractional time values do not produce NaN or unrecoverable error', () => {
  const state = createInitialEconomyState(0);

  // Fractional 0.4 ms elapsed
  const r1 = calculateAccrual(state, 0.4);
  assert.equal(r1.producedMs, 0.4);
  assert.equal(r1.earnedUnits, 4); // 10 yen/min * 0.4 ms = 4 units
  assert.equal(unitsToWholeYen(r1.earnedUnits), 0);
  assert.ok(Number.isFinite(r1.updatedState.uncollectedUnits));

  // Additional 0.6 ms elapsed (total 1.0 ms)
  const r2 = calculateAccrual(r1.updatedState, 1.0);
  assert.equal(r2.producedMs, 0.6);
  assert.equal(r2.earnedUnits, 6); // 10 yen/min * 0.6 ms = 6 units
  assert.equal(r2.updatedState.uncollectedUnits, 10); // Exactly 10 units for 1 full ms!
});

// -----------------------------------------------------------------------------
// Dimension 4: Repeated Micro-Collections (100,000 Iterations Stress Test)
// -----------------------------------------------------------------------------

test('ADV-07: 100,000 repeated micro-collections verify ZERO fractional yen loss against single collection', () => {
  let state = createInitialEconomyState(0); // rate = 10 yen/min = 10 units/ms
  const ITERATIONS = 100_000;

  // Run 100,000 discrete 1-ms accruals and collections
  for (let i = 1; i <= ITERATIONS; i++) {
    const col = collectEarnings(state, i);
    state = col.updatedState;
  }

  // Verification 1: Exactly 100,000 * 10 units = 1,000,000 units
  assert.equal(state.balanceUnits, 1_000_000);
  assert.equal(state.uncollectedUnits, 0);
  assert.equal(state.usedProductionMs, 0);
  assert.equal(state.accountedAtMs, ITERATIONS);

  // Verification 2: Whole yen check
  // 1,000,000 / 60,000 = 16 whole yen with remainder 40,000 units (2/3 yen)
  assert.equal(unitsToWholeYen(state.balanceUnits), 16);
  assert.equal(state.balanceUnits % YEN_UNIT_MULTIPLIER, 40_000);

  // Verification 3: Compare with a single 100,000 ms collection from same initial state
  const singleState = createInitialEconomyState(0);
  const singleCol = collectEarnings(singleState, ITERATIONS);

  assert.equal(singleCol.newBalanceUnits, 1_000_000);
  assert.equal(unitsToWholeYen(singleCol.newBalanceUnits), 16);
  assert.equal(
    state.balanceUnits,
    singleCol.newBalanceUnits,
    'Zero fractional yen loss: 100,000 micro-collections must EXACTLY equal 1 atomic collection',
  );
});

test('ADV-08: 100,000 repeated micro-accruals without collection match single atomic accrual', () => {
  let state = createInitialEconomyState(0);
  const ITERATIONS = 100_000;

  for (let i = 1; i <= ITERATIONS; i++) {
    const acc = calculateAccrual(state, i);
    state = acc.updatedState;
  }

  assert.equal(state.uncollectedUnits, 1_000_000);
  assert.equal(state.usedProductionMs, 100_000);
  assert.equal(state.accountedAtMs, 100_000);

  const singleState = createInitialEconomyState(0);
  const singleAcc = calculateAccrual(singleState, ITERATIONS);

  assert.equal(state.uncollectedUnits, singleAcc.updatedState.uncollectedUnits);
  assert.equal(state.usedProductionMs, singleAcc.updatedState.usedProductionMs);
});

// -----------------------------------------------------------------------------
// Dimension 5: Capacity Mismatches & Degenerate Capacities
// -----------------------------------------------------------------------------

test('ADV-09: Degenerate kitchen and service capacities produce 0 income safely', () => {
  // Case A: Kitchen = 0, Service = 10
  const rA = calculateProductionRate(0, 10, 15);
  assert.equal(rA.ordersPerMinute, 0);
  assert.equal(rA.yenPerMinute, 0);
  assert.equal(rA.bottleneck, 'kitchen');

  // Case B: Kitchen = 10, Service = 0
  const rB = calculateProductionRate(10, 0, 15);
  assert.equal(rB.ordersPerMinute, 0);
  assert.equal(rB.yenPerMinute, 0);
  assert.equal(rB.bottleneck, 'service');

  // Case C: Both = 0
  const rC = calculateProductionRate(0, 0, 15);
  assert.equal(rC.ordersPerMinute, 0);
  assert.equal(rC.yenPerMinute, 0);
  assert.equal(rC.bottleneck, 'none');

  // Case D: Negative capacities clamped to 0
  const rD = calculateProductionRate(-5, -10, 15);
  assert.equal(rD.ordersPerMinute, 0);
  assert.equal(rD.yenPerMinute, 0);
  assert.equal(rD.bottleneck, 'none');

  // Case E: Average revenue = 0
  const rE = calculateProductionRate(5, 5, 0);
  assert.equal(rE.ordersPerMinute, 5);
  assert.equal(rE.yenPerMinute, 0);
  assert.equal(rE.bottleneck, 'none');
});

test('ADV-10: Accrual with 0 capacity advances time and cap consumption without creating money', () => {
  const zeroCapState = createInitialEconomyState(0, {
    kitchenCapacity: 0,
    serviceCapacity: 5,
  });

  const oneHour = MS_PER_HOUR;
  const res = calculateAccrual(zeroCapState, oneHour);

  assert.equal(res.elapsedMs, oneHour);
  assert.equal(res.producedMs, oneHour);
  assert.equal(res.earnedUnits, 0, 'No money earned with 0 kitchen capacity');
  assert.equal(res.updatedState.usedProductionMs, oneHour);
  assert.equal(res.updatedState.uncollectedUnits, 0);
});

// -----------------------------------------------------------------------------
// Dimension 6: Mid-Period Upgrade Stress & Boundary Conditions
// -----------------------------------------------------------------------------

test('ADV-11: Upgrade with exact spendable funds leaves exactly 0 units in balance', () => {
  const priceYen = 300;
  const exactPriceUnits = yenToUnits(priceYen); // 18,000,000 units

  const state = createInitialEconomyState(0, {
    balanceUnits: exactPriceUnits,
  });

  const res = applyProspectiveUpgrade(state, 0, {
    itemId: 'prep_counter_1',
    priceYen,
    kitchenCapacityDelta: 2,
  });

  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.updatedState.balanceUnits, 0);
    assert.equal(unitsToWholeYen(res.updatedState.balanceUnits), 0);
    assert.equal(res.updatedState.kitchenCapacity, 3);
  }
});

test('ADV-12: Upgrade with exactly 1 unit less than price is strictly rejected', () => {
  const priceYen = 300;
  const exactPriceUnits = yenToUnits(priceYen);

  const state = createInitialEconomyState(0, {
    balanceUnits: exactPriceUnits - 1, // 1 unit short (1/60000 yen short!)
  });

  const res = applyProspectiveUpgrade(state, 0, {
    itemId: 'prep_counter_1',
    priceYen,
    kitchenCapacityDelta: 2,
  });

  assert.equal(res.success, false);
  if (!res.success) {
    assert.equal(res.reason, 'INSUFFICIENT_FUNDS');
    assert.equal(res.requiredUnits, exactPriceUnits);
    assert.equal(res.actualUnits, exactPriceUnits - 1);
  }
});

test('ADV-13: Uncollected register revenue cannot be spent on upgrades without collection', () => {
  const state = createInitialEconomyState(0, {
    balanceUnits: 0,
    uncollectedUnits: yenToUnits(10_000), // Huge register balance
  });

  const res = applyProspectiveUpgrade(state, 0, {
    itemId: 'prep_counter_1',
    priceYen: 300,
  });

  assert.equal(res.success, false);
  if (!res.success) {
    assert.equal(res.reason, 'INSUFFICIENT_FUNDS');
    assert.equal(res.actualUnits, 0);
  }
});

test('ADV-14: Consecutive upgrades in the exact same millisecond compose correctly', () => {
  let state = createInitialEconomyState(0, {
    balanceUnits: yenToUnits(10_000),
  });

  // Upgrade 1: Kitchen +2 (300 yen)
  const upg1 = applyProspectiveUpgrade(state, 0, {
    itemId: 'prep_counter_1',
    priceYen: 300,
    kitchenCapacityDelta: 2,
  });
  assert.equal(upg1.success, true);
  if (upg1.success) state = upg1.updatedState;

  // Upgrade 2: Service +2 (3600 yen)
  const upg2 = applyProspectiveUpgrade(state, 0, {
    itemId: 'conveyor_belt_1',
    priceYen: 3600,
    serviceCapacityDelta: 2,
  });
  assert.equal(upg2.success, true);
  if (upg2.success) state = upg2.updatedState;

  // Upgrade 3: Cap 12h (1800 yen)
  const upg3 = applyProspectiveUpgrade(state, 0, {
    itemId: 'cap_extension_1',
    priceYen: 1800,
    newCapMs: EXTENDED_CAP_MS,
  });
  assert.equal(upg3.success, true);
  if (upg3.success) state = upg3.updatedState;

  // Verify composed state:
  // Total cost: 300 + 3600 + 1800 = 5,700 yen. Balance: 10,000 - 5,700 = 4,300 yen
  assert.equal(unitsToWholeYen(state.balanceUnits), 4300);
  assert.equal(state.kitchenCapacity, 3); // 1 + 2
  assert.equal(state.serviceCapacity, 4); // 2 + 2
  assert.equal(state.capMs, EXTENDED_CAP_MS); // 12h
  assert.equal(state.usedProductionMs, 0);

  // Rate now: min(3, 4) * 10 = 30 yen/min, kitchen bottleneck
  const rate = calculateProductionRate(
    state.kitchenCapacity,
    state.serviceCapacity,
    state.averageRevenuePerOrder,
  );
  assert.equal(rate.yenPerMinute, 30);
  assert.equal(rate.bottleneck, 'kitchen');
});

test('ADV-15: Cap downgrade / anomaly where newCapMs < usedProductionMs halts further production safely', () => {
  // If an anomalous upgrade sets capMs smaller than already used production
  const state = createInitialEconomyState(0, {
    usedProductionMs: 8 * MS_PER_HOUR,
    capMs: 4 * MS_PER_HOUR, // cap smaller than used!
  });

  const res = calculateAccrual(state, 1 * MS_PER_HOUR);

  assert.equal(res.producedMs, 0, 'No production when usedProductionMs >= capMs');
  assert.equal(res.excessMs, 1 * MS_PER_HOUR);
  assert.equal(res.earnedUnits, 0);
  assert.equal(res.isCapped, true);
  assert.equal(res.remainingCapMs, 0);
});

// -----------------------------------------------------------------------------
// Dimension 7: Arithmetic Overflow & Safe Integer Boundaries
// -----------------------------------------------------------------------------

test('ADV-16: Arithmetic operations remain within JavaScript Number.MAX_SAFE_INTEGER bounds', () => {
  // 1 billion yen = 60,000,000,000,000 units (60 trillion units).
  // Number.MAX_SAFE_INTEGER is ~9,007,199,254,740,991 (9 quadrillion units).
  // Max possible yen in safe integer is ~150 billion yen!
  const hugeUnits = yenToUnits(1_000_000_000); // 1 billion yen
  assert.ok(Number.isSafeInteger(hugeUnits));

  const state = createInitialEconomyState(0, {
    balanceUnits: hugeUnits,
  });

  // Collect some more earnings
  const col = collectEarnings(state, 8 * MS_PER_HOUR);
  assert.ok(Number.isSafeInteger(col.newBalanceUnits));
  assert.equal(unitsToWholeYen(col.newBalanceUnits), 1_000_004_800);

  // Deduct large price
  const upg = applyProspectiveUpgrade(col.updatedState, 8 * MS_PER_HOUR, {
    itemId: 'mega_upgrade',
    priceYen: 500_000_000,
  });
  assert.equal(upg.success, true);
  if (upg.success) {
    assert.ok(Number.isSafeInteger(upg.updatedState.balanceUnits));
    assert.equal(unitsToWholeYen(upg.updatedState.balanceUnits), 500_004_800);
  }
});

// -----------------------------------------------------------------------------
// Dimension 8: Invariant Fuzzing Harness (2,000 Random Operations)
// -----------------------------------------------------------------------------

test('ADV-17: Fuzz harness with 2,000 random actions maintains all economy invariants strictly', () => {
  let state: SushiEconomyState = createInitialEconomyState(1_000_000, {
    balanceUnits: yenToUnits(50_000), // starting bankroll
  });

  let currentSimTime = 1_000_000;
  const OPERATIONS = 2_000;

  // Simple deterministic pseudorandom generator for reproducibility
  let seed = 123456789;
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  for (let step = 0; step < OPERATIONS; step++) {
    const actionRoll = rand();

    if (actionRoll < 0.5) {
      // Action A: Accrual with random delta (can be 0, small ms, hours, or negative clock glitch)
      const dtRoll = rand();
      let dtMs = 0;
      if (dtRoll < 0.05) {
        dtMs = -Math.floor(rand() * 100_000); // Clock glitch backward
      } else if (dtRoll < 0.4) {
        dtMs = Math.floor(rand() * 100); // 0 - 100 ms micro delta
      } else if (dtRoll < 0.8) {
        dtMs = Math.floor(rand() * 4 * MS_PER_HOUR); // 0 - 4 hours
      } else {
        dtMs = Math.floor(rand() * 48 * MS_PER_HOUR); // 0 - 48 hours (overflow cap)
      }

      currentSimTime = Math.max(1_000_000, currentSimTime + dtMs);
      const acc = calculateAccrual(state, currentSimTime);
      state = acc.updatedState;

      // Invariant checks on accrual:
      assert.ok(acc.producedMs <= acc.elapsedMs, 'producedMs <= elapsedMs');
      assert.ok(acc.earnedUnits >= 0, 'earnedUnits >= 0');
      assert.equal(
        acc.excessMs,
        Math.max(0, acc.elapsedMs - acc.producedMs),
        'excessMs definition',
      );
    } else if (actionRoll < 0.8) {
      // Action B: Manual Collection
      const dtMs = Math.floor(rand() * 10_000);
      currentSimTime += dtMs;

      const col = collectEarnings(state, currentSimTime);
      state = col.updatedState;

      // Invariant checks on collection:
      assert.equal(state.uncollectedUnits, 0, 'Register emptied after collection');
      assert.equal(state.usedProductionMs, 0, 'Used production time reset after collection');
      assert.ok(
        col.newBalanceUnits >= col.previousBalanceUnits,
        'Balance never decreases on collection',
      );
    } else {
      // Action C: Prospective Upgrade attempt
      const priceYen = Math.floor(rand() * 2000);
      const capDelta = rand() < 0.2 ? EXTENDED_CAP_MS : undefined;
      const kitchenDelta = rand() < 0.4 ? 1 : 0;
      const serviceDelta = rand() < 0.4 ? 1 : 0;

      const dtMs = Math.floor(rand() * 1_000);
      currentSimTime += dtMs;

      const upg = applyProspectiveUpgrade(state, currentSimTime, {
        itemId: `fuzz_item_${step}`,
        priceYen,
        newCapMs: capDelta,
        kitchenCapacityDelta: kitchenDelta,
        serviceCapacityDelta: serviceDelta,
      });

      if (upg.success) {
        state = upg.updatedState;
      } else {
        assert.equal(upg.reason, 'INSUFFICIENT_FUNDS');
        state = upg.currentState;
      }
    }

    // GLOBAL INVARIANTS MUST HOLD AT EVERY STEP:
    assert.ok(Number.isFinite(state.balanceUnits), `balanceUnits is finite at step ${step}`);
    assert.ok(
      Number.isSafeInteger(state.balanceUnits),
      `balanceUnits is safe integer at step ${step}`,
    );
    assert.ok(state.balanceUnits >= 0, `balanceUnits >= 0 at step ${step}`);
    assert.ok(state.uncollectedUnits >= 0, `uncollectedUnits >= 0 at step ${step}`);
    assert.ok(state.usedProductionMs >= 0, `usedProductionMs >= 0 at step ${step}`);
    assert.ok(state.usedProductionMs <= state.capMs, `usedProductionMs <= capMs at step ${step}`);
    assert.ok(state.accountedAtMs >= 1_000_000, `accountedAtMs does not rewind at step ${step}`);
  }
});

// -----------------------------------------------------------------------------
// Dimension 9: Free Upgrades and Stopped Time Discard Verification
// -----------------------------------------------------------------------------

test('ADV-18: Zero-price upgrade (free item / decoration) executes without debiting wallet', () => {
  const state = createInitialEconomyState(0, {
    balanceUnits: 50_000,
  });

  const res = applyProspectiveUpgrade(state, 0, {
    itemId: 'free_item',
    priceYen: 0,
    kitchenCapacityDelta: 1,
  });

  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.debitedUnits, 0);
    assert.equal(res.updatedState.balanceUnits, 50_000);
    assert.equal(res.updatedState.kitchenCapacity, 2);
  }
});

test('ADV-19: Upgrades after long stopped time discard all stopped time and apply new cap cleanly', () => {
  // Start base state at T=0
  const state = createInitialEconomyState(0, {
    balanceUnits: yenToUnits(5000),
  });

  // 24 hours elapse (8h productive, 16h stopped)
  const t24h = 24 * MS_PER_HOUR;
  const upgRes = applyProspectiveUpgrade(state, t24h, {
    itemId: 'cap_extension_1',
    priceYen: 1800,
    newCapMs: EXTENDED_CAP_MS, // 12h cap
  });

  assert.equal(upgRes.success, true);
  if (upgRes.success) {
    const upgraded = upgRes.updatedState;
    // Accounted time advanced all the way to 24h
    assert.equal(upgraded.accountedAtMs, t24h);
    // Used production time is capped at 8h
    assert.equal(upgraded.usedProductionMs, DEFAULT_CAP_MS);
    // Uncollected earnings reflect exactly 8h at 10 yen/min = 4,800 yen (no retroactive pay for 16h stopped)
    assert.equal(unitsToWholeYen(upgraded.uncollectedUnits), 4800);

    // Now test 2 hours of new production from T=24h to T=26h
    const t26h = 26 * MS_PER_HOUR;
    const acc = calculateAccrual(upgraded, t26h);
    // Earned 2 hours * 10 yen/min = +1,200 yen -> Total 6,000 yen
    assert.equal(unitsToWholeYen(acc.updatedState.uncollectedUnits), 6000);
    assert.equal(acc.updatedState.usedProductionMs, 10 * MS_PER_HOUR); // 8h + 2h = 10h
    assert.equal(acc.isCapped, false);
    assert.equal(acc.remainingCapMs, 2 * MS_PER_HOUR); // 2 hours remain under 12h cap
  }
});
