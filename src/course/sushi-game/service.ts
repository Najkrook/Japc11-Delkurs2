// Browser boundary: production always uses authenticated callable functions.
import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import {
  SushiService,
  type SushiRestaurantRepository,
  type CollectRevenueResult,
} from './domain-service.ts';
import type { SushiRestaurantState, DecorationSlot, EquipDecorationResult } from './types.ts';
import type { PurchaseItemResult } from './catalog.ts';
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
  return injected
    ? injected.getOrInitRestaurant(uid, nowMs, initialGrants)
    : remote(uid, { operation: 'load' });
}
export async function syncMedalGrants(
  uid: string,
  earnedGrants: string[],
  nowMs = Date.now(),
): Promise<SushiRestaurantState> {
  return injected
    ? injected.syncMedalGrants(uid, earnedGrants, nowMs)
    : remote(uid, { operation: 'load' });
}
export async function collectRevenue(
  uid: string,
  idempotencyKey: string,
  nowMs = Date.now(),
): Promise<CollectRevenueResult> {
  return injected
    ? injected.collectRevenue(uid, idempotencyKey, nowMs)
    : remote(uid, { operation: 'collect', idempotencyKey });
}
export async function purchaseCatalogItem(
  uid: string,
  itemId: string,
  idempotencyKey?: string,
  nowMs = Date.now(),
): Promise<PurchaseItemResult> {
  return injected
    ? injected.purchaseCatalogItem(uid, itemId, idempotencyKey, nowMs)
    : remote(uid, { operation: 'purchase', itemId, idempotencyKey });
}
export const purchaseUpgrade = purchaseCatalogItem;

export async function equipDecoration(
  uid: string,
  slot: DecorationSlot,
  itemId: string | null,
  idempotencyKey: string,
): Promise<EquipDecorationResult> {
  return injected
    ? injected.equipDecoration(uid, slot, itemId, idempotencyKey)
    : remote(uid, { operation: 'equip', slot, itemId, idempotencyKey });
}
