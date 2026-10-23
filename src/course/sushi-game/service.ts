/**
 * Restaurant Service & Repository Layer
 * JAPC11 Delkurs 2 Prototype
 *
 * Provides transactional restaurant initialization and atomic revenue collection.
 * Supports both Firestore (production/emulator) and InMemory (fast unit tests).
 */

import {
  calculateAccrual,
  createDefaultRestaurantState,
  unitsToWholeYen,
} from './economy.ts';
import { mergePermanentGrants } from './medals.ts';
import {
  getCatalogItem,
  type SushiCatalogItem,
  type PurchaseItemResult,
  type PurchaseSuccessResult,
  type PurchaseFailureResult,
  type PurchaseFailureReason,
} from './catalog.ts';
import type {
  SushiRestaurantState,
} from './types.ts';
import {
  doc,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';

export type {
  SushiCatalogItem,
  PurchaseItemResult,
  PurchaseSuccessResult,
  PurchaseFailureResult,
  PurchaseFailureReason,
};

export interface CollectRevenueResult {
  state: SushiRestaurantState;
  collectedUnits: number;
  collectedYen: number;
  wasAlreadyProcessed: boolean;
}

export interface SushiRestaurantRepository {
  get(uid: string): Promise<SushiRestaurantState | null>;
  set(state: SushiRestaurantState): Promise<void>;
  transaction<T>(
    uid: string,
    updateFn: (current: SushiRestaurantState | null) => Promise<{ state: SushiRestaurantState | null; result: T }>,
  ): Promise<T>;
}

export interface SushiStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function sushiStorageKey(uid: string): string {
  return `japc11-dk2-sushi-v1-${uid}`;
}

/**
 * In-Memory Repository for unit tests and offline fast execution.
 * Simulates Firestore transactions per-user.
 * Optionally mirrors state to a backing storage (e.g. window.localStorage in browser).
 */
export class InMemorySushiRepository implements SushiRestaurantRepository {
  private storage = new Map<string, SushiRestaurantState>();
  private locks = new Map<string, Promise<unknown>>();
  private backingStorage: SushiStorageLike | null;

  constructor(backingStorage: SushiStorageLike | null = null) {
    this.backingStorage = backingStorage;
  }

  public getBackingStorage(): SushiStorageLike | null {
    return this.backingStorage;
  }

  public async get(uid: string): Promise<SushiRestaurantState | null> {
    let existing = this.storage.get(uid);

    // If not in memory, attempt lazy hydration from backing storage
    if (!existing && this.backingStorage) {
      try {
        const raw = this.backingStorage.getItem(sushiStorageKey(uid));
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SushiRestaurantState>;
          if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.id === uid &&
            typeof parsed.balanceUnits === 'number' &&
            typeof parsed.uncollectedUnits === 'number'
          ) {
            existing = parsed as SushiRestaurantState;
            this.storage.set(uid, existing);
          }
        }
      } catch {
        /* Ignore JSON parse errors or storage access denial */
      }
    }

    if (!existing) return null;
    return JSON.parse(JSON.stringify(existing)) as SushiRestaurantState;
  }

  public async set(state: SushiRestaurantState | null): Promise<void> {
    if (!state) return;
    const cloned = JSON.parse(JSON.stringify(state)) as SushiRestaurantState;
    this.storage.set(state.id, cloned);

    if (this.backingStorage) {
      try {
        this.backingStorage.setItem(sushiStorageKey(state.id), JSON.stringify(cloned));
      } catch {
        /* Private browsing, quota exceeded, or disabled storage */
      }
    }
  }

  public async transaction<T>(
    uid: string,
    updateFn: (current: SushiRestaurantState | null) => Promise<{ state: SushiRestaurantState | null; result: T }>,
  ): Promise<T> {
    // Chain transactions for this UID to ensure serialized atomic execution
    const prev = this.locks.get(uid) || Promise.resolve();
    let resolveLock: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(uid, nextLock);

    try {
      await prev;
      const current = await this.get(uid);
      const { state, result } = await updateFn(current);
      if (state) {
        await this.set(state);
      }
      return result;
    } finally {
      resolveLock();
      if (this.locks.get(uid) === nextLock) {
        this.locks.delete(uid);
      }
    }
  }

  public clear(): void {
    if (this.backingStorage) {
      try {
        for (const uid of this.storage.keys()) {
          this.backingStorage.removeItem(sushiStorageKey(uid));
        }
      } catch {
        /* Ignore storage errors */
      }
    }
    this.storage.clear();
    this.locks.clear();
  }
}

/**
 * Firestore Repository for live Firebase / emulator execution.
 */
export class FirestoreSushiRepository implements SushiRestaurantRepository {
  private firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  public async get(uid: string): Promise<SushiRestaurantState | null> {
    const ref = doc(this.firestore, 'users', uid, 'sushi', 'restaurant');
    const snap = await runTransaction(this.firestore, async (tx) => tx.get(ref));
    if (!snap.exists()) return null;
    return snap.data() as SushiRestaurantState;
  }

  public async set(state: SushiRestaurantState): Promise<void> {
    const ref = doc(this.firestore, 'users', state.id, 'sushi', 'restaurant');
    await runTransaction(this.firestore, async (tx) => {
      tx.set(ref, state);
    });
  }

  public async transaction<T>(
    uid: string,
    updateFn: (current: SushiRestaurantState | null) => Promise<{ state: SushiRestaurantState | null; result: T }>,
  ): Promise<T> {
    const ref = doc(this.firestore, 'users', uid, 'sushi', 'restaurant');
    return await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists() ? (snap.data() as SushiRestaurantState) : null;
      const { state, result } = await updateFn(current);
      if (state) {
        tx.set(ref, state);
      }
      return result;
    });
  }
}

/**
 * SushiService manages business logic and repository interactions.
 */
export class SushiService {
  private repo: SushiRestaurantRepository;

  constructor(repo: SushiRestaurantRepository) {
    this.repo = repo;
  }

  public getRepository(): SushiRestaurantRepository {
    return this.repo;
  }

  public setRepository(repo: SushiRestaurantRepository): void {
    this.repo = repo;
  }

  /**
   * Initializes a new restaurant if none exists, or lazily evaluates accrual up to nowMs.
   * If initialGrants is supplied, retroactively merges newly eligible grants into permanentGrants.
   */
  public async getOrInitRestaurant(
    uid: string,
    nowMs: number = Date.now(),
    initialGrants?: string[],
  ): Promise<SushiRestaurantState> {
    if (!uid) {
      throw new Error('INVALID_UID: User UID must be provided');
    }

    return await this.repo.transaction(uid, async (current) => {
      if (!current) {
        const fresh = createDefaultRestaurantState(uid, nowMs);
        if (initialGrants && initialGrants.length > 0) {
          fresh.permanentGrants = mergePermanentGrants([], initialGrants);
        }
        return { state: fresh, result: fresh };
      }

      // Existing restaurant: lazy accrual up to server nowMs
      const accrual = calculateAccrual(current, nowMs);
      const existingGrants = Array.isArray(current.permanentGrants) ? current.permanentGrants : [];
      const mergedGrants =
        initialGrants && initialGrants.length > 0
          ? mergePermanentGrants(existingGrants, initialGrants)
          : existingGrants;

      const updated: SushiRestaurantState = {
        ...current,
        uncollectedUnits: accrual.updatedState.uncollectedUnits,
        usedProductionMs: accrual.updatedState.usedProductionMs,
        accountedAtMs: accrual.updatedState.accountedAtMs,
        permanentGrants: mergedGrants,
        updatedAtMs: nowMs,
      };

      return { state: updated, result: updated };
    });
  }

  /**
   * Synchronizes course medal grants into permanentGrants.
   * Enforces strict non-revocation: permanentGrants = mergePermanentGrants(current.permanentGrants, earnedGrants).
   * Automatically initializes the restaurant if it does not yet exist.
   */
  public async syncMedalGrants(
    uid: string,
    earnedGrants: string[],
    nowMs: number = Date.now(),
  ): Promise<SushiRestaurantState> {
    if (!uid) {
      throw new Error('INVALID_UID: User UID must be provided');
    }
    if (!Array.isArray(earnedGrants)) {
      throw new Error('INVALID_GRANTS: earnedGrants must be an array of strings');
    }

    return await this.repo.transaction(uid, async (current) => {
      if (!current) {
        // Cold start: restaurant created directly via medal sync
        const fresh = createDefaultRestaurantState(uid, nowMs);
        fresh.permanentGrants = mergePermanentGrants([], earnedGrants);
        return { state: fresh, result: fresh };
      }

      // Lazy accrual up to nowMs
      const accrual = calculateAccrual(current, nowMs);
      const existingGrants = Array.isArray(current.permanentGrants) ? current.permanentGrants : [];
      const mergedGrants = mergePermanentGrants(existingGrants, earnedGrants);

      const updated: SushiRestaurantState = {
        ...current,
        uncollectedUnits: accrual.updatedState.uncollectedUnits,
        usedProductionMs: accrual.updatedState.usedProductionMs,
        accountedAtMs: accrual.updatedState.accountedAtMs,
        permanentGrants: mergedGrants,
        updatedAtMs: nowMs,
      };

      return { state: updated, result: updated };
    });
  }

  /**
   * Atomically collects uncollected revenue into spendable balanceUnits.
   * Protects against duplicate payouts via idempotencyKey.
   */
  public async collectRevenue(
    uid: string,
    idempotencyKey: string,
    nowMs: number = Date.now(),
  ): Promise<CollectRevenueResult> {
    if (!uid) {
      throw new Error('INVALID_UID: User UID must be provided');
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new Error('INVALID_IDEMPOTENCY_KEY: idempotencyKey must be a non-empty string');
    }

    return await this.repo.transaction<CollectRevenueResult>(uid, async (current) => {
      if (!current) {
        throw new Error('RESTAURANT_NOT_FOUND: User does not have an active restaurant');
      }

      // Check idempotency: if already processed, return stored state without crediting again
      if (idempotencyKey && current.processedRequests && Object.hasOwn(current.processedRequests, idempotencyKey)) {
        return {
          state: current,
          result: {
            state: current,
            collectedUnits: 0,
            collectedYen: 0,
            wasAlreadyProcessed: true,
          },
        };
      }

      // 1. Accrue up to collection time
      const accrual = calculateAccrual(current, nowMs);
      const accruedState = accrual.updatedState;
      const transferredUnits = accruedState.uncollectedUnits;
      const newBalanceUnits = accruedState.balanceUnits + transferredUnits;
      const transferredYen = unitsToWholeYen(transferredUnits);

      // 2. Record idempotency key
      const updatedProcessedRequests = {
        ...(current.processedRequests || {}),
        [idempotencyKey]: {
          processedAtMs: nowMs,
          resultSummary: `collected ${transferredUnits} units (${transferredYen} yen)`,
        },
      };

      // 3. Reset uncollected register and timer
      const updatedState: SushiRestaurantState = {
        ...current,
        balanceUnits: newBalanceUnits,
        uncollectedUnits: 0,
        usedProductionMs: 0,
        accountedAtMs: Math.max(accruedState.accountedAtMs, nowMs),
        periodStartMs: Math.max(accruedState.accountedAtMs, nowMs),
        updatedAtMs: nowMs,
        processedRequests: updatedProcessedRequests,
      };

      return {
        state: updatedState,
        result: {
          state: updatedState,
          collectedUnits: transferredUnits,
          collectedYen: transferredYen,
          wasAlreadyProcessed: false,
        },
      };
    });
  }

  /**
   * Purchases a restaurant upgrade from the catalog.
   *
   * Transaction rules:
   * 1. Rejects if userId or itemId is missing/invalid.
   * 2. Rejects if restaurant does not exist (RESTAURANT_NOT_FOUND).
   * 3. Checks idempotency: if idempotencyKey was already processed, returns cached result without double-charging.
   * 4. Rejects if itemId is not found in catalog (ITEM_NOT_FOUND).
   * 5. Duplicate check: rejects if already in inventory (ALREADY_OWNED).
   * 6. Unlock check: rejects if not in permanentGrants (ITEM_LOCKED).
   * 7. Prospective accrual: accounts up to nowMs at OLD rates & OLD cap.
   * 8. Spendable balance check: rejects if balanceUnits < priceUnits (INSUFFICIENT_FUNDS).
   *    Persists intermediate accrual state so student keeps uncollected income earned up to nowMs.
   * 9. Deducts priceUnits from balanceUnits, appends itemId to inventory, applies stat deltas,
   *    preserves uncollectedUnits and usedProductionMs, advances accountedAtMs, and records idempotencyKey.
   */
  public async purchaseCatalogItem(
    uid: string,
    itemId: string,
    idempotencyKey?: string,
    nowMs: number = Date.now(),
  ): Promise<PurchaseItemResult> {
    if (!uid || typeof uid !== 'string' || !uid.trim()) {
      throw new Error('INVALID_UID: User UID must be provided');
    }
    if (!itemId || typeof itemId !== 'string' || !itemId.trim()) {
      throw new Error('INVALID_ITEM_ID: Item ID must be provided');
    }

    return await this.repo.transaction<PurchaseItemResult>(uid, async (current) => {
      if (!current) {
        return {
          state: null,
          result: {
            success: false,
            reason: 'RESTAURANT_NOT_FOUND',
            message: 'User does not have an active restaurant',
          },
        };
      }

      const item = getCatalogItem(itemId);

      // Idempotency check: Object.hasOwn prevents prototype pollution exploits
      if (idempotencyKey && current.processedRequests && Object.hasOwn(current.processedRequests, idempotencyKey)) {
        return {
          state: current,
          result: {
            success: true,
            state: current,
            restaurant: current,
            item: item!,
            purchasedItem: item!,
            debitedUnits: item ? item.priceUnits : 0,
            debitedYen: item ? item.priceYen : 0,
            wasAlreadyProcessed: true,
          },
        };
      }

      if (!item) {
        return {
          state: current,
          result: {
            success: false,
            reason: 'ITEM_NOT_FOUND',
            message: `Föremålet "${itemId}" finns inte i butikskatalogen.`,
            state: current,
            restaurant: current,
          },
        };
      }

      // Check if already owned (all MVP catalog upgrades have exactly 1 purchasable tier)
      const isAlreadyOwned = Array.isArray(current.inventory) && current.inventory.includes(itemId);
      if (isAlreadyOwned) {
        return {
          state: current,
          result: {
            success: false,
            reason: 'ALREADY_OWNED',
            message: `Du äger redan "${item.name}". Föremålet kan bara köpas en gång.`,
            state: current,
            restaurant: current,
            item,
            purchasedItem: item,
          },
        };
      }

      // Check medal grant prerequisite
      const isUnlocked = Array.isArray(current.permanentGrants) && current.permanentGrants.includes(itemId);
      if (!isUnlocked) {
        return {
          state: current,
          result: {
            success: false,
            reason: 'ITEM_LOCKED',
            message: `"${item.name}" är låst. Uppnå ${item.requiredTierLabel}medalj i Kapitel ${item.requiredLesson} för att låsa upp köpmöjligheten.`,
            state: current,
            restaurant: current,
            item,
            purchasedItem: item,
          },
        };
      }

      // Prospective accrual at previous rates and cap up to nowMs
      const accrual = calculateAccrual(current, nowMs);
      const intermediateState = accrual.updatedState;

      // Spendable balance validation: uncollected revenue CANNOT fund purchases!
      const priceUnits = item.priceUnits;
      if (intermediateState.balanceUnits < priceUnits) {
        // Persist intermediate accrual so user keeps earned uncollected revenue
        const accruedCurrent: SushiRestaurantState = {
          ...current,
          uncollectedUnits: intermediateState.uncollectedUnits,
          usedProductionMs: intermediateState.usedProductionMs,
          accountedAtMs: intermediateState.accountedAtMs,
          updatedAtMs: nowMs,
        };

        return {
          state: accruedCurrent,
          result: {
            success: false,
            reason: 'INSUFFICIENT_FUNDS',
            message: `Otillräckligt saldo. Föremålet kostar ¥ ${item.priceYen} (${priceUnits} enheter), men du har endast ¥ ${unitsToWholeYen(
              intermediateState.balanceUnits,
            )} disponibla yen.`,
            requiredUnits: priceUnits,
            actualUnits: intermediateState.balanceUnits,
            state: accruedCurrent,
            restaurant: accruedCurrent,
            item,
            purchasedItem: item,
          },
        };
      }

      // Apply atomic state transition
      const newBalanceUnits = intermediateState.balanceUnits - priceUnits;
      const newInventory = [...(current.inventory || []), itemId];
      const newKitchen = intermediateState.kitchenCapacity + (item.kitchenCapacityDelta ?? 0);
      const newService = intermediateState.serviceCapacity + (item.serviceCapacityDelta ?? 0);
      const newAvgRev = intermediateState.averageRevenuePerOrder + (item.averageRevenueDelta ?? 0);
      const newCapMs = item.newCapMs ?? intermediateState.capMs;

      const updatedProcessedRequests = idempotencyKey
        ? {
            ...(current.processedRequests || {}),
            [idempotencyKey]: {
              processedAtMs: nowMs,
              resultSummary: `purchased ${itemId} for ${priceUnits} units (${item.priceYen} yen)`,
            },
          }
        : (current.processedRequests || {});

      const updatedState: SushiRestaurantState = {
        ...current,
        balanceUnits: newBalanceUnits,
        uncollectedUnits: intermediateState.uncollectedUnits, // Preserved!
        usedProductionMs: intermediateState.usedProductionMs, // Preserved!
        accountedAtMs: nowMs,
        kitchenCapacity: newKitchen,
        serviceCapacity: newService,
        averageRevenuePerOrder: newAvgRev,
        capMs: newCapMs,
        inventory: newInventory,
        updatedAtMs: nowMs,
        processedRequests: updatedProcessedRequests,
      };

      return {
        state: updatedState,
        result: {
          success: true,
          state: updatedState,
          restaurant: updatedState,
          item,
          purchasedItem: item,
          debitedUnits: priceUnits,
          debitedYen: item.priceYen,
          wasAlreadyProcessed: false,
        },
      };
    });
  }

  public async purchaseUpgrade(
    uid: string,
    itemId: string,
    idempotencyKey?: string,
    nowMs: number = Date.now(),
  ): Promise<PurchaseItemResult> {
    return await this.purchaseCatalogItem(uid, itemId, idempotencyKey, nowMs);
  }
}

// Global default singleton instance: mirror to localStorage in browser environment
const defaultBrowserStorage: SushiStorageLike | null =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? window.localStorage
    : null;

export const sushiService = new SushiService(new InMemorySushiRepository(defaultBrowserStorage));

export async function getOrInitRestaurant(
  uid: string,
  nowMs: number = Date.now(),
  initialGrants?: string[],
): Promise<SushiRestaurantState> {
  return await sushiService.getOrInitRestaurant(uid, nowMs, initialGrants);
}

export async function syncMedalGrants(
  uid: string,
  earnedGrants: string[],
  nowMs: number = Date.now(),
): Promise<SushiRestaurantState> {
  return await sushiService.syncMedalGrants(uid, earnedGrants, nowMs);
}

export async function collectRevenue(
  uid: string,
  idempotencyKey: string,
  nowMs: number = Date.now(),
): Promise<CollectRevenueResult> {
  return await sushiService.collectRevenue(uid, idempotencyKey, nowMs);
}

export async function purchaseCatalogItem(
  uid: string,
  itemId: string,
  idempotencyKey?: string,
  nowMs: number = Date.now(),
): Promise<PurchaseItemResult> {
  return await sushiService.purchaseCatalogItem(uid, itemId, idempotencyKey, nowMs);
}

export async function purchaseUpgrade(
  uid: string,
  itemId: string,
  idempotencyKey?: string,
  nowMs: number = Date.now(),
): Promise<PurchaseItemResult> {
  return await sushiService.purchaseCatalogItem(uid, itemId, idempotencyKey, nowMs);
}
