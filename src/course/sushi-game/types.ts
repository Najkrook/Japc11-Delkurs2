/**
 * Shared Type Definitions for Sushi Restaurant Tycoon Game
 * JAPC11 Delkurs 2 Prototype
 */

// ==========================================
// 1. Constants
// ==========================================

export const YEN_UNIT_MULTIPLIER = 60_000; // 1 Yen = 60,000 internal units (1/60000 yen per unit)
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

export const DEFAULT_CAP_MS = 24 * MS_PER_HOUR;
export const EXTENDED_CAP_MS = 48 * MS_PER_HOUR;
export const CURRENT_BALANCE_VERSION = 2;

export const DEFAULT_KITCHEN_CAPACITY = 1; // 1 order/min
export const DEFAULT_SERVICE_CAPACITY = 2; // 2 orders/min
export const DEFAULT_AVERAGE_REVENUE = 10; // 10 yen/order

// ==========================================
// 2. State Interfaces
// ==========================================

export interface SushiEquippedDecorations {
  wallSlot: string | null;
  floorSlot: string | null;
}

export type DecorationSlot = keyof SushiEquippedDecorations;
export type EquipDecorationResult =
  | { success: true; state: SushiRestaurantState; wasAlreadyProcessed: boolean }
  | { success: false; message: string };

export interface SushiProcessedRequest {
  processedAtMs: number;
  resultSummary?: string;
}

/**
 * Minimal state required for economy calculations.
 * Subset of the full SushiRestaurantState.
 */
export interface SushiEconomyState {
  accountedAtMs: number; // Last timestamp accounting was evaluated
  usedProductionMs: number; // Cumulative productive ms consumed in current collection period
  capMs: number; // Active cap in integer milliseconds (24h base, 48h extended).
  kitchenCapacity: number; // Kitchen throughput in orders/min
  serviceCapacity: number; // Service throughput in orders/min
  averageRevenuePerOrder: number; // Average revenue per order in whole yen
  balanceUnits: number; // Spendable wallet balance in 1/60000 yen units
  uncollectedUnits: number; // Uncollected register balance in 1/60000 yen units
  periodStartMs?: number; // Start timestamp of the current collection period
}

/**
 * Full persistent restaurant state in Firestore (/users/{userId}/sushi/restaurant).
 */
export interface SushiRestaurantState extends SushiEconomyState {
  schemaVersion: number; // 1
  /** Missing on restaurants created before the balance audit remedies. */
  balanceVersion?: number;
  /** Preserves a previously purchased license's revenue until new bonuses catch up. */
  legacyRevenueFloor?: number;
  id: string; // Firebase Auth UID (same as ownerUid)
  ownerUid: string;
  createdAtMs: number;
  updatedAtMs: number;
  periodStartMs: number;
  permanentGrants: string[]; // Unlocked catalog item IDs earned from medals
  inventory: string[]; // Purchased catalog item IDs
  /** Optional cosmetic savings goals; never required for course or catalog completion. */
  completedProjects?: string[];
  equipped: SushiEquippedDecorations;
  activeRecipe: string; // e.g. 'basic_nigiri'
  processedRequests: Record<string, SushiProcessedRequest>;
}

// ==========================================
// 3. Calculation & Operation Results
// ==========================================

export type BottleneckType = 'kitchen' | 'service' | 'none';

export interface ProductionRate {
  ordersPerMinute: number;
  yenPerMinute: number;
  bottleneck: BottleneckType;
}

export interface AccrualResult {
  elapsedMs: number; // Raw time elapsed since last accountedAtMs
  producedMs: number; // Productive ms elapsed up to remaining cap
  excessMs: number; // Discarded ms beyond the cap
  earnedUnits: number; // New units earned in this interval
  isCapped: boolean; // True if usedProductionMs has reached capMs
  remainingCapMs: number; // ms remaining before cap is reached
  rate: ProductionRate; // Rate used for this accrual interval
  updatedState: SushiEconomyState; // State advanced to nowMs
}

export interface CollectionResult {
  transferredUnits: number; // Amount transferred from uncollected to balance
  transferredYenWhole: number; // Floor whole yen transferred
  previousBalanceUnits: number;
  newBalanceUnits: number;
  accrual: AccrualResult; // The intermediate accrual up to collection time
  updatedState: SushiEconomyState; // State with register emptied & timers reset
}

export interface EconomyUpgrade {
  itemId: string;
  priceYen: number;
  priceUnits?: number; // Optional override; defaults to priceYen * 60,000
  kitchenCapacityDelta?: number;
  serviceCapacityDelta?: number;
  averageRevenueDelta?: number;
  newCapMs?: number;
}

export interface UpgradeSuccessResult {
  success: true;
  debitedUnits: number;
  accrualBeforeUpgrade: AccrualResult;
  updatedState: SushiEconomyState;
}

export interface UpgradeFailureResult {
  success: false;
  reason: 'INSUFFICIENT_FUNDS' | 'ALREADY_OWNED' | 'INVALID_UPGRADE';
  requiredUnits: number;
  actualUnits: number;
  currentState: SushiEconomyState;
}

export type UpgradeResult = UpgradeSuccessResult | UpgradeFailureResult;
