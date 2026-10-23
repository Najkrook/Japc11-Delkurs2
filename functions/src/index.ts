import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  SushiService,
  type SushiRestaurantRepository,
} from '../../src/course/sushi-game/domain-service.ts';
import { evaluateMedalGrants, mergePermanentGrants } from '../../src/course/sushi-game/medals.ts';
import { readCourseProgress } from '../../src/course/course-state.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';

initializeApp();
const db = getFirestore();

export const sushi = onCall({ region: 'europe-west1', maxInstances: 10 }, async (request) => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider !== 'google.com') {
    throw new HttpsError('unauthenticated', 'Sign in with Google to use your restaurant.');
  }
  const uid = request.auth.uid;
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Expected an operation.');
  }
  const { operation, itemId, idempotencyKey } = data;
  if (data.expectedUid !== uid) {
    throw new HttpsError('permission-denied', 'The account changed. Reload your restaurant.');
  }
  if (!['load', 'collect', 'purchase'].includes(operation)) {
    throw new HttpsError('invalid-argument', 'Unknown restaurant operation.');
  }
  const allowed =
    operation === 'load'
      ? ['operation', 'expectedUid']
      : operation === 'collect'
        ? ['operation', 'expectedUid', 'idempotencyKey']
        : ['operation', 'expectedUid', 'idempotencyKey', 'itemId'];
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new HttpsError('invalid-argument', 'Restaurant state is determined by the server.');
  }
  if (
    operation !== 'load' &&
    (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(idempotencyKey))
  ) {
    throw new HttpsError('invalid-argument', 'A valid request ID is required.');
  }
  if (
    operation === 'purchase' &&
    (typeof itemId !== 'string' || !/^[a-z0-9_]{1,64}$/.test(itemId))
  ) {
    throw new HttpsError('invalid-argument', 'A catalog item ID is required.');
  }
  const restaurantRef = db.doc(`users/${uid}/sushi/restaurant`);
  const courseRef = db.doc(`users/${uid}/progress/course`);
  return db.runTransaction(async (tx) => {
    // Read both documents in the same transaction; retries re-evaluate server time and grants.
    const [restaurant, course] = await tx.getAll(restaurantRef, courseRef);
    const payload = course.data()?.payload;
    const progress = readCourseProgress(
      { getItem: () => (typeof payload === 'string' ? payload : null) },
      uid,
    );
    const grants = evaluateMedalGrants(progress);
    const current = restaurant.exists ? (restaurant.data() as SushiRestaurantState) : null;
    if (current) current.permanentGrants = mergePermanentGrants(current.permanentGrants, grants);
    const repo: SushiRestaurantRepository = {
      async get() {
        throw new Error('Use transaction');
      },
      async set() {
        throw new Error('Use transaction');
      },
      async transaction(_uid, update) {
        const { state, result } = await update(current);
        if (state) tx.set(restaurantRef, state);
        return result;
      },
    };
    const service = new SushiService(repo);
    const now = Date.now();
    if (operation === 'load') return service.getOrInitRestaurant(uid, now, grants);
    if (!current) throw new HttpsError('failed-precondition', 'Load your restaurant first.');
    // Separate operation/item namespaces prevent a reused key from authorizing another action.
    if (operation === 'collect')
      return service.collectRevenue(uid, `collect:${idempotencyKey}`, now);
    return service.purchaseCatalogItem(uid, itemId, `purchase:${itemId}:${idempotencyKey}`, now);
  });
});
