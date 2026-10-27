/**
 * Pure Economy Domain Logic for Sushi Restaurant Tycoon Game
 * JAPC11 Delkurs 2 Prototype
 *
 * Implements strict integer math (1/60000 yen units and integer milliseconds).
 * Zero floating-point drift, bounded configurable idle cap, prospective upgrade rules.
 */

import {
  YEN_UNIT_MULTIPLIER,
  DEFAULT_CAP_MS,
  DEFAULT_KITCHEN_CAPACITY,
  DEFAULT_SERVICE_CAPACITY,
  DEFAULT_AVERAGE_REVENUE,
  CURRENT_BALANCE_VERSION,
} from './types.ts';
import type {
  SushiEconomyState,
  SushiRestaurantState,
  ProductionRate,
  BottleneckType,
  AccrualResult,
  CollectionResult,
  EconomyUpgrade,
  UpgradeResult,
} from './types.ts';

// ==========================================
// 1. Currency & Time Formatting Helpers
// ==========================================

/**
 * Converts internal accounting units (1/60000 yen) to whole displayed yen, rounded down.
 */
export function unitsToWholeYen(units: number): number {
  if (units <= 0) return 0;
  return Math.floor(units / YEN_UNIT_MULTIPLIER);
}

/**
 * Converts internal accounting units to exact floating-point yen (for debugging or exact decimal display).
 */
export function unitsToYenDecimal(units: number): number {
  return units / YEN_UNIT_MULTIPLIER;
}

/**
 * Converts whole yen to internal accounting units.
 */
export function yenToUnits(yen: number): number {
  return Math.round(yen * YEN_UNIT_MULTIPLIER);
}

/**
 * Checks whether the spendable balance is sufficient to cover a whole yen price.
 */
export function canAfford(balanceUnits: number, priceYen: number): boolean {
  return balanceUnits >= yenToUnits(priceYen);
}

// ==========================================
// 2. Production Rate & Bottleneck
// ==========================================

/**
 * Calculates current production rate and identifies the active bottleneck.
 * Formula:
 *   ordersPerMinute = min(kitchenCapacity, serviceCapacity)
 *   yenPerMinute = ordersPerMinute * averageRevenuePerOrder
 */
export function calculateProductionRate(
  kitchenCapacity: number,
  serviceCapacity: number,
  averageRevenuePerOrder: number,
): ProductionRate {
  const safeKitchen = Math.max(0, kitchenCapacity);
  const safeService = Math.max(0, serviceCapacity);
  const safeAvgRev = Math.max(0, averageRevenuePerOrder);

  const ordersPerMinute = Math.min(safeKitchen, safeService);
  const yenPerMinute = ordersPerMinute * safeAvgRev;

  let bottleneck: BottleneckType = 'none';
  if (safeKitchen < safeService) {
    bottleneck = 'kitchen';
  } else if (safeService < safeKitchen) {
    bottleneck = 'service';
  }

  return {
    ordersPerMinute,
    yenPerMinute,
    bottleneck,
  };
}

// ==========================================
// 3. Lazy Accrual Calculation
// ==========================================

/**
 * Computes idle revenue accrued between state.accountedAtMs and nowMs.
 *
 * Rules:
 * - Does not use a ticking server loop; lazy evaluation.
 * - Handles clock-skew/backward time safely (clamped to 0).
 * - Caps productive time at (capMs - usedProductionMs).
 * - Discards any excess stopped time beyond the cap.
 * - Multiplies yenPerMinute by producedMs (since 1 ms earns yenPerMinute units).
 * - Advances accountedAtMs to nowMs regardless of cap.
 */
export function calculateAccrual(state: SushiEconomyState, nowMs: number): AccrualResult {
  const rate = calculateProductionRate(
    state.kitchenCapacity,
    state.serviceCapacity,
    state.averageRevenuePerOrder,
  );

  // 1. Elapsed time clamped against backward clock drift
  const rawElapsed = nowMs - state.accountedAtMs;
  const elapsedMs = Math.max(0, rawElapsed);

  // 2. Production time remaining under cap
  const remainingCapMs = Math.max(0, state.capMs - state.usedProductionMs);

  // 3. Productive time and discarded excess time
  const producedMs = Math.min(elapsedMs, remainingCapMs);
  const excessMs = Math.max(0, elapsedMs - producedMs);

  // 4. Exact unit earnings: yenPerMinute * producedMs
  // In 1/60000 units, each ms at R yen/min earns exactly R units.
  const earnedUnits = rate.yenPerMinute * producedMs;

  const newUsedProductionMs = state.usedProductionMs + producedMs;
  const newUncollectedUnits = state.uncollectedUnits + earnedUnits;
  const newAccountedAtMs = Math.max(state.accountedAtMs, nowMs);
  const isCapped = newUsedProductionMs >= state.capMs;
  const finalRemainingCapMs = Math.max(0, state.capMs - newUsedProductionMs);

  const updatedState: SushiEconomyState = {
    ...state,
    accountedAtMs: newAccountedAtMs,
    usedProductionMs: newUsedProductionMs,
    uncollectedUnits: newUncollectedUnits,
  };

  return {
    elapsedMs,
    producedMs,
    excessMs,
    earnedUnits,
    isCapped,
    remainingCapMs: finalRemainingCapMs,
    rate,
    updatedState,
  };
}

// ==========================================
// 4. Manual Revenue Collection ("Hämta intäkter")
// ==========================================

/**
 * Transfers all uncollected cash register earnings into spendable yen.
 *
 * Rules:
 * 1. Evaluates accrual up to server nowMs first.
 * 2. Adds uncollectedUnits to balanceUnits (including any fractional remainder).
 * 3. Resets uncollectedUnits to 0 and usedProductionMs to 0.
 * 4. Starts a new collection period at nowMs.
 * 5. Excess waiting time beyond the cap never carries into the new period.
 * 6. Idempotent: repeated collections when uncollected is 0 transfer 0 safely.
 */
export function collectEarnings(state: SushiEconomyState, nowMs: number): CollectionResult {
  // Step 1: Account up to collection timestamp at current rates
  const accrual = calculateAccrual(state, nowMs);
  const accruedState = accrual.updatedState;

  // Step 2: Transfer all pending units to spendable balance
  const transferredUnits = accruedState.uncollectedUnits;
  const newBalanceUnits = accruedState.balanceUnits + transferredUnits;

  // Step 3: Reset register and timer
  const finalState: SushiEconomyState = {
    ...accruedState,
    balanceUnits: newBalanceUnits,
    uncollectedUnits: 0,
    usedProductionMs: 0,
    accountedAtMs: Math.max(accruedState.accountedAtMs, nowMs),
    periodStartMs: Math.max(accruedState.accountedAtMs, nowMs),
  };

  return {
    transferredUnits,
    transferredYenWhole: unitsToWholeYen(transferredUnits),
    previousBalanceUnits: state.balanceUnits,
    newBalanceUnits,
    accrual,
    updatedState: finalState,
  };
}

// ==========================================
// 5. Prospective Upgrades & Mid-Period Application
// ==========================================

/**
 * Applies a shop upgrade (kitchen capacity, service capacity, or cap extension) prospectively.
 *
 * Rules:
 * 1. Account up to server nowMs using PREVIOUS rate and cap.
 * 2. Debit upgrade price from spendable balanceUnits only (fails if insufficient).
 * 3. Uncollected earnings and usedProductionMs are preserved unchanged.
 * 4. Rate upgrades apply strictly to future elapsed time.
 * 5. Cap upgrades apply immediately to active period: remainingCap = newCap - usedProductionMs.
 * 6. Stopped time prior to nowMs is discarded; does not consume newly added cap.
 * 7. Does not collect earnings and does not restart the period.
 */
export function applyProspectiveUpgrade(
  state: SushiEconomyState,
  nowMs: number,
  upgrade: EconomyUpgrade,
): UpgradeResult {
  // Step 1: Account up to nowMs at previous rates
  const accrual = calculateAccrual(state, nowMs);
  const intermediate = accrual.updatedState;

  // Step 2: Validate spendable funds
  const priceUnits = upgrade.priceUnits ?? yenToUnits(upgrade.priceYen);
  if (intermediate.balanceUnits < priceUnits) {
    return {
      success: false,
      reason: 'INSUFFICIENT_FUNDS',
      requiredUnits: priceUnits,
      actualUnits: intermediate.balanceUnits,
      currentState: intermediate,
    };
  }

  // Step 3: Debit price
  const debitedBalanceUnits = intermediate.balanceUnits - priceUnits;

  // Step 4: Apply prospective stat changes
  const newKitchen = intermediate.kitchenCapacity + (upgrade.kitchenCapacityDelta ?? 0);
  const newService = intermediate.serviceCapacity + (upgrade.serviceCapacityDelta ?? 0);
  const newAvgRev = intermediate.averageRevenuePerOrder + (upgrade.averageRevenueDelta ?? 0);
  const newCapMs = upgrade.newCapMs ?? intermediate.capMs;

  const finalState: SushiEconomyState = {
    ...intermediate,
    balanceUnits: debitedBalanceUnits,
    kitchenCapacity: newKitchen,
    serviceCapacity: newService,
    averageRevenuePerOrder: newAvgRev,
    capMs: newCapMs,
    // accountedAtMs is already nowMs from accrual
  };

  return {
    success: true,
    debitedUnits: priceUnits,
    accrualBeforeUpgrade: accrual,
    updatedState: finalState,
  };
}

// ==========================================
// 6. State Factory
// ==========================================

/**
 * Creates the initial economy state for a new personal restaurant.
 */
export function createInitialEconomyState(
  nowMs: number,
  overrides: Partial<SushiEconomyState> = {},
): SushiEconomyState {
  return {
    accountedAtMs: nowMs,
    periodStartMs: nowMs,
    usedProductionMs: 0,
    capMs: DEFAULT_CAP_MS,
    kitchenCapacity: DEFAULT_KITCHEN_CAPACITY,
    serviceCapacity: DEFAULT_SERVICE_CAPACITY,
    averageRevenuePerOrder: DEFAULT_AVERAGE_REVENUE,
    balanceUnits: 0,
    uncollectedUnits: 0,
    ...overrides,
  };
}

/**
 * Creates the default persistent restaurant state for an authenticated user.
 */
export function createDefaultRestaurantState(
  uid: string,
  nowMs: number,
  overrides: Partial<SushiRestaurantState> = {},
): SushiRestaurantState {
  return {
    schemaVersion: 1,
    balanceVersion: CURRENT_BALANCE_VERSION,
    id: uid,
    ownerUid: uid,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    periodStartMs: nowMs,
    accountedAtMs: nowMs,
    usedProductionMs: 0,
    capMs: DEFAULT_CAP_MS,
    kitchenCapacity: DEFAULT_KITCHEN_CAPACITY,
    serviceCapacity: DEFAULT_SERVICE_CAPACITY,
    averageRevenuePerOrder: DEFAULT_AVERAGE_REVENUE,
    balanceUnits: 0,
    uncollectedUnits: 0,
    permanentGrants: [],
    inventory: [],
    completedProjects: [],
    equipped: {
      wallSlot: null,
      floorSlot: null,
    },
    activeRecipe: 'basic_nigiri',
    processedRequests: {},
    ...overrides,
  };
}
