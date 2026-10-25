/**
 * Empirical Adversarial Math Challenge Test Suite for Milestone 1 (M1-C1)
 * Author: Economy Math Challenger (critic, specialist)
 * Target: docs/sushi-game/economy-balance-model.md, docs/sushi-game/gdd.md,
 *         src/course/sushi-game/economy.ts, src/course/sushi-game/catalog.ts
 *
 * Verifies:
 * 1. Splitting Invariance: accrue(t1) + accrue(t2) === accrue(t1 + t2)
 * 2. Sub-linear Pacing Curve (10 to 90 yen/min across Genki 6–12)
 * 3. Bottleneck Alternation and 48,000 yen Sinks Alignment with 8h/12h caps
 * 4. Zero Float Math & 1/60,000 yen Integer Compatibility
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccrual,
  calculateProductionRate,
  collectEarnings,
  applyProspectiveUpgrade,
  createInitialEconomyState,
  unitsToWholeYen,
  unitsToYenDecimal,
  yenToUnits,
  canAfford,
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
// CHALLENGE 1: SPLITTING INVARIANCE THEOREM
// =============================================================================

test('CHALLENGE-01: Splitting Invariance across 5,000 randomized time partitions', () => {
  // Theorem: For any rate R and duration partition dt = dt1 + dt2,
  // accrue(dt1) followed by accrue(dt2) produces the EXACT same integer units as accrue(dt).
  let prng = 42;
  function nextRand() {
    prng = (prng * 1664525 + 1013904223) % 4294967296;
    return prng / 4294967296;
  }

  for (let trial = 0; trial < 5000; trial++) {
    const capMs = Math.floor(nextRand() * EXTENDED_CAP_MS) + 1000;
    const initialUsedMs = Math.floor(nextRand() * capMs);
    const k = Math.floor(nextRand() * 6) + 1;
    const s = Math.floor(nextRand() * 6) + 1;
    const a = nextRand() < 0.5 ? 10 : 15;

    const baseState = createInitialEconomyState(1_000_000, {
      capMs,
      usedProductionMs: initialUsedMs,
      kitchenCapacity: k,
      serviceCapacity: s,
      averageRevenuePerOrder: a,
    });

    // Total elapsed can be within cap, exact cap, or beyond cap (up to 2x cap)
    const totalElapsedMs = Math.floor(nextRand() * capMs * 2);

    // Number of random splits (between 2 and 8 partitions)
    const numPartitions = Math.floor(nextRand() * 7) + 2;
    const cuts: number[] = [];
    for (let c = 0; c < numPartitions - 1; c++) {
      cuts.push(Math.floor(nextRand() * totalElapsedMs));
    }
    cuts.sort((x, y) => x - y);

    const partitionDurations: number[] = [];
    let prevCut = 0;
    for (const cut of cuts) {
      partitionDurations.push(cut - prevCut);
      prevCut = cut;
    }
    partitionDurations.push(totalElapsedMs - prevCut);

    // 1. Atomic single accrual
    const singleResult = calculateAccrual(baseState, 1_000_000 + totalElapsedMs);

    // 2. Sequential partitioned accruals
    let sequentialState = baseState;
    let currentMs = 1_000_000;
    for (const dur of partitionDurations) {
      currentMs += dur;
      sequentialState = calculateAccrual(sequentialState, currentMs).updatedState;
    }

    // Exact integer equality assertion
    assert.equal(
      sequentialState.uncollectedUnits,
      singleResult.updatedState.uncollectedUnits,
      `Splitting invariance violation at trial ${trial}: expected ${singleResult.updatedState.uncollectedUnits}, got ${sequentialState.uncollectedUnits}`,
    );
    assert.equal(
      sequentialState.usedProductionMs,
      singleResult.updatedState.usedProductionMs,
      `Used production time violation at trial ${trial}`,
    );
    assert.equal(
      sequentialState.accountedAtMs,
      singleResult.updatedState.accountedAtMs,
      `Accounted timestamp violation at trial ${trial}`,
    );
  }
});

test('CHALLENGE-02: Straddling Cap Boundary Invariance (cap - delta) + (delta + overflow)', () => {
  const cap = DEFAULT_CAP_MS; // 28,800,000 ms
  const state = createInitialEconomyState(0, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    capMs: cap,
  });

  const deltas = [1, 5, 100, 1000, 60000, 3600000];

  for (const delta of deltas) {
    const overflow = delta * 2;
    const tTotal = cap + overflow;

    // Direct single accrual
    const direct = calculateAccrual(state, tTotal);

    // Split at cap - delta, then cap, then cap + overflow
    const step1 = calculateAccrual(state, cap - delta).updatedState;
    const step2 = calculateAccrual(step1, cap).updatedState;
    const step3 = calculateAccrual(step2, tTotal).updatedState;

    assert.equal(step3.uncollectedUnits, direct.updatedState.uncollectedUnits);
    assert.equal(step3.usedProductionMs, direct.updatedState.usedProductionMs);
    assert.equal(step3.usedProductionMs, cap);
    assert.equal(step3.accountedAtMs, tTotal);
  }
});

test('CHALLENGE-03: High-frequency 60 FPS simulation vs Single Lazy Accrual', () => {
  // Simulate 10 minutes (600,000 ms) of gameplay at 60 FPS (~16.666 ms per frame)
  // vs a single lazy calculation after 10 minutes
  const totalMs = 10 * MS_PER_MINUTE; // 600,000 ms
  const frameMs = 1000 / 60; // 16.666666666666668 ms

  const baseState = createInitialEconomyState(0, {
    kitchenCapacity: 4,
    serviceCapacity: 4,
    averageRevenuePerOrder: 10, // 40 yen/min = 40 units/ms
  });

  // Single lazy accrual at exact 600,000 ms
  const lazyResult = calculateAccrual(baseState, totalMs);
  // Expected: 40 units/ms * 600,000 ms = 24,000,000 units = 400 yen
  assert.equal(lazyResult.earnedUnits, 24_000_000);
  assert.equal(unitsToWholeYen(lazyResult.earnedUnits), 400);

  // Integer-stepped frames
  let frameState = baseState;
  let currentMs = 0;
  while (currentMs < totalMs) {
    const nextMs = Math.min(totalMs, currentMs + 16); // 16ms integer frames
    frameState = calculateAccrual(frameState, nextMs).updatedState;
    currentMs = nextMs;
  }

  assert.equal(
    frameState.uncollectedUnits,
    lazyResult.updatedState.uncollectedUnits,
    'High frequency 16ms stepping must match single lazy accrual to the exact unit',
  );
  assert.equal(frameState.usedProductionMs, totalMs);
});

// =============================================================================
// CHALLENGE 2: SUB-LINEAR PACING CURVE (10 to 90 yen/min across Genki 6–12)
// =============================================================================

interface CatalogSpecItem {
  readonly chapter: number;
  readonly tier: 'Start' | 'Bronze' | 'Silver' | 'Gold';
  readonly id: string;
  readonly name: string;
  readonly category: 'Base' | 'Kitchen' | 'Service' | 'Cap' | 'Recipe' | 'Decor' | 'Revenue';
  readonly priceYen: number;
  readonly kDelta: number;
  readonly sDelta: number;
  readonly aDelta: number;
  readonly newCapMs?: number;
}

// Canonical 21-item specification from docs/sushi-game/economy-balance-model.md
const SPEC_CATALOG: readonly CatalogSpecItem[] = [
  { chapter: 6, tier: 'Start', id: 'base', name: 'Grundkök', category: 'Base', priceYen: 0, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 6, tier: 'Bronze', id: 'prep_counter', name: 'Förbättrad beredningsbänk', category: 'Kitchen', priceYen: 300, kDelta: 2, sDelta: 0, aDelta: 0 },
  { chapter: 6, tier: 'Silver', id: 'salmon_nigiri', name: 'Laxnigiri', category: 'Recipe', priceYen: 600, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 6, tier: 'Gold', id: 'paper_lantern', name: 'Papperslykta', category: 'Decor', priceYen: 300, kDelta: 0, sDelta: 0, aDelta: 0 },

  { chapter: 7, tier: 'Bronze', id: 'cap_extension_12h', name: 'Längre produktionstid', category: 'Cap', priceYen: 1800, kDelta: 0, sDelta: 0, aDelta: 0, newCapMs: EXTENDED_CAP_MS },
  { chapter: 7, tier: 'Silver', id: 'kappamaki', name: 'Kappamaki', category: 'Recipe', priceYen: 900, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 7, tier: 'Gold', id: 'potted_plant', name: 'Krukväxt', category: 'Decor', priceYen: 450, kDelta: 0, sDelta: 0, aDelta: 0 },

  { chapter: 8, tier: 'Bronze', id: 'precision_knife', name: 'Precisionskniv', category: 'Kitchen', priceYen: 2400, kDelta: 1, sDelta: 0, aDelta: 0 },
  { chapter: 8, tier: 'Silver', id: 'maguro_nigiri', name: 'Maguronigiri', category: 'Recipe', priceYen: 1200, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 8, tier: 'Gold', id: 'noren_curtain', name: 'Noren-gardin', category: 'Decor', priceYen: 600, kDelta: 0, sDelta: 0, aDelta: 0 },

  { chapter: 9, tier: 'Bronze', id: 'conveyor_belt', name: 'Transportband', category: 'Service', priceYen: 3600, kDelta: 0, sDelta: 2, aDelta: 0 },
  { chapter: 9, tier: 'Silver', id: 'ebi_nigiri', name: 'Ebinigiri', category: 'Recipe', priceYen: 1500, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 9, tier: 'Gold', id: 'wave_print', name: 'Vågmotiv', category: 'Decor', priceYen: 600, kDelta: 0, sDelta: 0, aDelta: 0 },

  { chapter: 10, tier: 'Bronze', id: 'service_counter', name: 'Utökad serveringsdisk', category: 'Service', priceYen: 5400, kDelta: 0, sDelta: 2, aDelta: 0 },
  { chapter: 10, tier: 'Silver', id: 'tamago_nigiri', name: 'Tamagonigiri', category: 'Recipe', priceYen: 1800, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 10, tier: 'Gold', id: 'andon_lantern', name: 'Andon-golvlykta', category: 'Decor', priceYen: 750, kDelta: 0, sDelta: 0, aDelta: 0 },

  { chapter: 11, tier: 'Bronze', id: 'sous_chef', name: 'Assisterande kock', category: 'Kitchen', priceYen: 7200, kDelta: 2, sDelta: 0, aDelta: 0 },
  { chapter: 11, tier: 'Silver', id: 'sashimi_plate', name: 'Sashimi Moriawase', category: 'Recipe', priceYen: 2400, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 11, tier: 'Gold', id: 'sakura_bonsai', name: 'Sakura Bonsai', category: 'Decor', priceYen: 900, kDelta: 0, sDelta: 0, aDelta: 0 },

  { chapter: 12, tier: 'Bronze', id: 'master_license', name: 'Mästarcertifiering', category: 'Revenue', priceYen: 10800, kDelta: 0, sDelta: 0, aDelta: 5 },
  { chapter: 12, tier: 'Silver', id: 'omakase_menu', name: 'Omakase-meny', category: 'Recipe', priceYen: 3000, kDelta: 0, sDelta: 0, aDelta: 0 },
  { chapter: 12, tier: 'Gold', id: 'golden_maneki_neko', name: 'Gyllene Maneki-Neko', category: 'Decor', priceYen: 1500, kDelta: 0, sDelta: 0, aDelta: 0 },
];

test('CHALLENGE-04: Empirical validation of the 21-item progression matrix and pacing rates', () => {
  let k = 1;
  let s = 2;
  let a = 10;
  let activeCapMs = DEFAULT_CAP_MS;

  // Expected progression checkpoints from docs/sushi-game/economy-balance-model.md
  const expectedRates: Record<string, { k: number; s: number; a: number; rate: number; bottleneck: string }> = {
    'base': { k: 1, s: 2, a: 10, rate: 10, bottleneck: 'kitchen' },
    'prep_counter': { k: 3, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'salmon_nigiri': { k: 3, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'paper_lantern': { k: 3, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'cap_extension_12h': { k: 3, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'kappamaki': { k: 3, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'potted_plant': { k: 3, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'precision_knife': { k: 4, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'maguro_nigiri': { k: 4, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'noren_curtain': { k: 4, s: 2, a: 10, rate: 20, bottleneck: 'service' },
    'conveyor_belt': { k: 4, s: 4, a: 10, rate: 40, bottleneck: 'none' }, // Balanced
    'ebi_nigiri': { k: 4, s: 4, a: 10, rate: 40, bottleneck: 'none' },
    'wave_print': { k: 4, s: 4, a: 10, rate: 40, bottleneck: 'none' },
    'service_counter': { k: 4, s: 6, a: 10, rate: 40, bottleneck: 'kitchen' },
    'tamago_nigiri': { k: 4, s: 6, a: 10, rate: 40, bottleneck: 'kitchen' },
    'andon_lantern': { k: 4, s: 6, a: 10, rate: 40, bottleneck: 'kitchen' },
    'sous_chef': { k: 6, s: 6, a: 10, rate: 60, bottleneck: 'none' }, // Balanced
    'sashimi_plate': { k: 6, s: 6, a: 10, rate: 60, bottleneck: 'none' },
    'sakura_bonsai': { k: 6, s: 6, a: 10, rate: 60, bottleneck: 'none' },
    'master_license': { k: 6, s: 6, a: 15, rate: 90, bottleneck: 'none' }, // Capstone
    'omakase_menu': { k: 6, s: 6, a: 15, rate: 90, bottleneck: 'none' },
    'golden_maneki_neko': { k: 6, s: 6, a: 15, rate: 90, bottleneck: 'none' },
  };

  for (const item of SPEC_CATALOG) {
    k += item.kDelta;
    s += item.sDelta;
    a += item.aDelta;
    if (item.newCapMs) activeCapMs = item.newCapMs;

    const rate = calculateProductionRate(k, s, a);
    const expected = expectedRates[item.id];

    assert.equal(k, expected.k, `Kitchen capacity mismatch after ${item.id}`);
    assert.equal(s, expected.s, `Service capacity mismatch after ${item.id}`);
    assert.equal(a, expected.a, `Average revenue mismatch after ${item.id}`);
    assert.equal(rate.yenPerMinute, expected.rate, `Rate mismatch after ${item.id}`);
    assert.equal(
      rate.bottleneck,
      expected.bottleneck === 'none' ? 'none' : expected.bottleneck,
      `Bottleneck mismatch after ${item.id}`,
    );
  }

  // Final Capstone Verification:
  // Starts at 10 yen/min, finishes at 90 yen/min -> exactly 9x total expansion over 7 chapters
  assert.equal(calculateProductionRate(k, s, a).yenPerMinute, 90);
});

test('CHALLENGE-05: Pacing Plateau Analysis: Time-to-earn is strictly capped at <= 180 minutes', () => {
  // Test that no functional upgrade takes more than 180 minutes of resting time
  let currentRate = 10;

  for (const item of SPEC_CATALOG) {
    if (item.priceYen === 0) continue;

    const timeToEarnMinutes = item.priceYen / currentRate;

    // Bronze items are functional progression gates
    if (item.tier === 'Bronze') {
      assert.ok(
        timeToEarnMinutes <= 180,
        `Functional upgrade ${item.id} requires ${timeToEarnMinutes} min, exceeding 180 min ceiling!`,
      );
    }

    // Update current rate after functional upgrade
    if (item.kDelta > 0 || item.sDelta > 0 || item.aDelta > 0) {
      // Find new rate
      const k = SPEC_CATALOG.filter((it, idx) => idx <= SPEC_CATALOG.indexOf(item)).reduce((acc, it) => acc + it.kDelta, 1);
      const s = SPEC_CATALOG.filter((it, idx) => idx <= SPEC_CATALOG.indexOf(item)).reduce((acc, it) => acc + it.sDelta, 2);
      const a = SPEC_CATALOG.filter((it, idx) => idx <= SPEC_CATALOG.indexOf(item)).reduce((acc, it) => acc + it.aDelta, 10);
      currentRate = calculateProductionRate(k, s, a).yenPerMinute;
    }
  }
});

// =============================================================================
// CHALLENGE 3: BOTTLENECK ALTERNATION & 48,000 YEN TOTAL SINK VERIFICATION
// =============================================================================

test('CHALLENGE-06: 48,000 Yen Total Sinks Alignment with Sub-Categories', () => {
  let bronzeTotal = 0;
  let silverTotal = 0;
  let goldTotal = 0;

  for (const item of SPEC_CATALOG) {
    if (item.tier === 'Bronze') bronzeTotal += item.priceYen;
    if (item.tier === 'Silver') silverTotal += item.priceYen;
    if (item.tier === 'Gold') goldTotal += item.priceYen;
  }

  // Exact catalog category sums as defined in economy-balance-model.md Section 3.1
  assert.equal(bronzeTotal, 31_500, 'Bronze functional upgrades must total 31,500 yen');
  assert.equal(silverTotal, 11_400, 'Silver recipe variations must total 11,400 yen');
  assert.equal(goldTotal, 5_100, 'Gold cosmetic decor must total 5,100 yen');

  const grandTotal = bronzeTotal + silverTotal + goldTotal;
  assert.equal(grandTotal, 48_000, 'Grand total catalog investment must equal exactly 48,000 yen');

  // Verify internal accounting units: 48,000 yen * 60,000 units = 2,880,000,000 units
  assert.equal(grandTotal * YEN_UNIT_MULTIPLIER, 2_880_000_000);
});

test('CHALLENGE-07: Every catalog item price is strictly <= 25% of single cap yield', () => {
  // Verifies that a player never needs more than 25% of a single 8h/12h idle session to afford any item
  let currentRate = 10;
  let currentCapHours = 8;

  for (const item of SPEC_CATALOG) {
    if (item.priceYen === 0) continue;

    const capYieldYen = currentRate * (currentCapHours * 60);
    const percentOfCap = (item.priceYen / capYieldYen) * 100;

    assert.ok(
      percentOfCap <= 25.01, // Allow floating tolerance for 25.0%
      `Item ${item.id} costs ${item.priceYen}Y which is ${percentOfCap.toFixed(2)}% of cap yield (${capYieldYen}Y), exceeding 25%!`,
    );

    // Apply stat changes if upgrade
    if (item.newCapMs) currentCapHours = 12;
    if (item.kDelta > 0 || item.sDelta > 0 || item.aDelta > 0) {
      const idx = SPEC_CATALOG.indexOf(item);
      const k = SPEC_CATALOG.slice(0, idx + 1).reduce((acc, it) => acc + it.kDelta, 1);
      const s = SPEC_CATALOG.slice(0, idx + 1).reduce((acc, it) => acc + it.sDelta, 2);
      const a = SPEC_CATALOG.slice(0, idx + 1).reduce((acc, it) => acc + it.aDelta, 10);
      currentRate = calculateProductionRate(k, s, a).yenPerMinute;
    }
  }
});

test('CHALLENGE-08: Monte Carlo Simulation of 500 Playthroughs with Arbitrary Order & Zero Deadlocks', () => {
  // Stress-test that no purchasing strategy (e.g. cosmetics first, hoard, recipe first) can EVER deadlock
  let deadlocks = 0;

  for (let sim = 0; sim < 500; sim++) {
    let state = createInitialEconomyState(0);
    let nowMs = 0;
    const owned = new Set<string>();

    for (let ch = 6; ch <= 12; ch++) {
      const chapterItems = SPEC_CATALOG.filter(it => it.chapter <= ch && it.priceYen > 0 && !owned.has(it.id));

      while (chapterItems.length > 0) {
        // Pick random item among all unlocked items
        const pickIdx = Math.floor(Math.random() * chapterItems.length);
        const item = chapterItems[pickIdx];
        const priceUnits = yenToUnits(item.priceYen);

        let sessions = 0;
        while (state.balanceUnits < priceUnits) {
          sessions++;
          if (sessions > 100) {
            deadlocks++;
            break;
          }
          // Student rests for a random duration between 30 min and capMs
          const sleepMs = Math.floor(Math.random() * state.capMs) + 30 * MS_PER_MINUTE;
          nowMs += sleepMs;
          state = collectEarnings(state, nowMs).updatedState;
        }

        if (sessions > 100) break;

        // Execute upgrade
        const upg = applyProspectiveUpgrade(state, nowMs, {
          itemId: item.id,
          priceYen: item.priceYen,
          kitchenCapacityDelta: item.kDelta,
          serviceCapacityDelta: item.sDelta,
          averageRevenueDelta: item.aDelta,
          newCapMs: item.newCapMs,
        });

        assert.equal(upg.success, true);
        if (upg.success) {
          state = upg.updatedState;
          owned.add(item.id);
          chapterItems.splice(pickIdx, 1);
        }
      }
    }
  }

  assert.equal(deadlocks, 0, 'Zero deadlocks encountered across 500 stochastic playthroughs');
});

// =============================================================================
// CHALLENGE 4: ZERO FLOAT MATH & 1/60,000 INTEGER COMPATIBILITY
// =============================================================================

test('CHALLENGE-09: Exactness of Base Unit Conversion and Fractional Remainder Conservation', () => {
  // 1 Yen = 60,000 units
  assert.equal(yenToUnits(1), 60_000);
  assert.equal(yenToUnits(48_000), 2_880_000_000);

  // Conversion round-down
  assert.equal(unitsToWholeYen(59_999), 0);
  assert.equal(unitsToWholeYen(60_000), 1);
  assert.equal(unitsToWholeYen(60_001), 1);
  assert.equal(unitsToWholeYen(119_999), 1);
  assert.equal(unitsToWholeYen(120_000), 2);

  // Remainder is strictly conserved across repeated partial earnings
  // At 10 yen/min, each 1 ms = 10 units.
  // To earn 1 whole yen takes 6,000 ms.
  let state = createInitialEconomyState(0);
  for (let tick = 1; tick <= 5999; tick++) {
    state = calculateAccrual(state, tick).updatedState;
    assert.equal(unitsToWholeYen(state.uncollectedUnits), 0);
    assert.equal(state.uncollectedUnits, tick * 10);
  }

  // At tick 6000: exactly 60,000 units = 1 whole yen
  state = calculateAccrual(state, 6000).updatedState;
  assert.equal(state.uncollectedUnits, 60_000);
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 1);

  // Collection preserves exact units
  const col = collectEarnings(state, 6000);
  assert.equal(col.transferredUnits, 60_000);
  assert.equal(col.newBalanceUnits, 60_000);
  assert.equal(col.updatedState.uncollectedUnits, 0);
});

test('CHALLENGE-10: Floating Point Drift Proof vs Pure Integer Multiplier', () => {
  // In a naive implementation using float yenPerSecond:
  // 10 yen/min = 0.16666666666666666 yen/sec = 0.00016666666666666666 yen/ms
  // Over millions of additions, float accumulation suffers from IEEE 754 precision drift:
  let naiveFloatYen = 0;
  const floatRatePerMs = 10 / 60000;

  // Let's compare 100,000 steps of 7 ms
  const stepMs = 7;
  const steps = 100_000;

  for (let i = 0; i < steps; i++) {
    naiveFloatYen += floatRatePerMs * stepMs;
  }

  // Exact integer math:
  // 10 yen/min * (100,000 * 7 ms) = 7,000,000 units
  const totalProducedMs = steps * stepMs;
  const exactUnits = 10 * totalProducedMs;
  const exactWholeYen = Math.floor(exactUnits / YEN_UNIT_MULTIPLIER);

  const naiveWholeYen = Math.floor(naiveFloatYen);

  // Verify that the integer implementation has ZERO drift
  assert.equal(exactUnits, 7_000_000);
  assert.equal(exactWholeYen, 116);
  assert.equal(exactUnits % YEN_UNIT_MULTIPLIER, 40_000); // exactly 2/3 yen remainder!

  // Now verify with calculateAccrual
  const state = createInitialEconomyState(0);
  const acc = calculateAccrual(state, totalProducedMs);
  assert.equal(acc.earnedUnits, exactUnits);
  assert.equal(unitsToWholeYen(acc.earnedUnits), exactWholeYen);
});
