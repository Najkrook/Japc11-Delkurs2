// Browser boundary: production always uses authenticated callable functions.
import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import {
  SushiService,
  InMemorySushiRepository,
  type SushiRestaurantRepository,
  type CollectRevenueResult,
} from './domain-service.ts';
import type { SushiRestaurantState, DecorationSlot, EquipDecorationResult } from './types.ts';
import type { PurchaseItemResult } from './catalog.ts';
import { isLocalhost } from './config.ts';
export * from './domain-service.ts';

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
    updateFn: (
      current: SushiRestaurantState | null,
    ) => Promise<{ state: SushiRestaurantState | null; result: T }>,
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

// Explicit injection for unit tests; never selected from browser storage or environment.
let injected: SushiService | undefined;
let localDevService: SushiService | undefined;

function getActiveService(): SushiService | null {
  if (injected) return injected;
  if (typeof window !== 'undefined' && isLocalhost(window)) {
    // If running with explicit Firebase emulators configured, prefer the emulated backend.
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    const isEmulated = metaEnv?.MODE === 'test' && metaEnv?.VITE_FIREBASE_EMULATORS === 'true';
    if (!isEmulated) {
      if (!localDevService) {
        localDevService = new SushiService(new InMemorySushiRepository(window.localStorage));
      }
      return localDevService;
    }
  }
  return null;
}

export const sushiService = {
  setRepository(repo: SushiRestaurantRepository) {
    injected = new SushiService(repo);
  },
  getRepository(): SushiRestaurantRepository {
    if (!injected) throw new Error('No test repository configured');
    return injected.getRepository();
  },
  getOrInitRestaurant,
};

let callable: Promise<(data: Record<string, unknown>) => Promise<{ data: unknown }>> | undefined;
async function remote<T>(uid: string, data: Record<string, unknown>): Promise<T> {
  const { auth, app, emulated } = await import('../../cloud.ts');
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('Authentication changed');
  callable ??= import('firebase/functions')
    .then(({ getFunctions, connectFunctionsEmulator, httpsCallable }) => {
      const functions = getFunctions(app, 'europe-west1');
      if (emulated) connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      return httpsCallable(functions, 'sushi', { timeout: 15_000 });
    })
    .catch((error: unknown) => {
      callable = undefined;
      throw error;
    });
  const call = await callable;
  if (auth.currentUser?.uid !== uid) throw new Error('Authentication changed');
  // The server checks this against auth.uid; it never selects an owner from this field.
  // This also covers account changes while the SDK obtains its authentication token.
  return (await call({ ...data, expectedUid: uid })).data as T;
}

export async function getOrInitRestaurant(
  uid: string,
  nowMs = Date.now(),
  initialGrants?: string[],
): Promise<SushiRestaurantState> {
  const active = getActiveService();
  if (active) {
    const state = await active.getOrInitRestaurant(uid, nowMs, initialGrants);
    if (
      active === localDevService &&
      uid === 'local-dev-user' &&
      state.balanceUnits === 0 &&
      state.uncollectedUnits === 0 &&
      state.inventory.length === 0
    ) {
      const seeded: SushiRestaurantState = {
        ...state,
        balanceUnits: 18_740 * 60_000,
        uncollectedUnits: 6_280 * 60_000,
      };
      await active.getRepository().set(seeded);
      return seeded;
    }
    return state;
  }
  return remote(uid, { operation: 'load' });
}
export async function syncMedalGrants(
  uid: string,
  earnedGrants: string[],
  nowMs = Date.now(),
): Promise<SushiRestaurantState> {
  const active = getActiveService();
  return active
    ? active.syncMedalGrants(uid, earnedGrants, nowMs)
    : remote(uid, { operation: 'load' });
}
export async function collectRevenue(
  uid: string,
  idempotencyKey: string,
  nowMs = Date.now(),
): Promise<CollectRevenueResult> {
  const active = getActiveService();
  return active
    ? active.collectRevenue(uid, idempotencyKey, nowMs)
    : remote(uid, { operation: 'collect', idempotencyKey });
}
export async function purchaseCatalogItem(
  uid: string,
  itemId: string,
  idempotencyKey?: string,
  nowMs = Date.now(),
): Promise<PurchaseItemResult> {
  const active = getActiveService();
  return active
    ? active.purchaseCatalogItem(uid, itemId, idempotencyKey, nowMs)
    : remote(uid, { operation: 'purchase', itemId, idempotencyKey });
}
export const purchaseUpgrade = purchaseCatalogItem;

export async function equipDecoration(
  uid: string,
  slot: DecorationSlot,
  itemId: string | null,
  idempotencyKey: string,
): Promise<EquipDecorationResult> {
  const active = getActiveService();
  return active
    ? active.equipDecoration(uid, slot, itemId, idempotencyKey)
    : remote(uid, { operation: 'equip', slot, itemId, idempotencyKey });
}
