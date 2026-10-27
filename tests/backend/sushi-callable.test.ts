import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithCredential,
  GoogleAuthProvider,
  signInAnonymously,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';
import { courseWeeks } from '../../src/course/data/index.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';
import type { CollectRevenueResult } from '../../src/course/sushi-game/domain-service.ts';
import type { PurchaseItemResult } from '../../src/course/sushi-game/catalog.ts';
import type { PurchaseRestaurantProjectResult } from '../../src/course/sushi-game/projects.ts';
import { DEFAULT_CAP_MS, EXTENDED_CAP_MS } from '../../src/course/sushi-game/types.ts';

test('authenticated callable persists authoritative economy, medals and concurrent retries', async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-japc11-delkurs2');
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const require = createRequire(new URL('../../functions/package.json', import.meta.url));
  const adminApp = require('firebase-admin/app');
  const admin = adminApp.initializeApp({ projectId: 'demo-japc11-delkurs2' }, 'sushi-test-admin');
  const adminDb = require('firebase-admin/firestore').getFirestore(admin);
  const apps: ReturnType<typeof initializeApp>[] = [];
  const client = (name: string) => {
    const app = initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, name);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
      disableWarnings: true,
    });
    const functions = getFunctions(app, 'europe-west1');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    const call = async <T>(data: object) =>
      (
        await httpsCallable<object, T>(
          functions,
          'sushi',
        )({ expectedUid: auth.currentUser?.uid, ...data })
      ).data;
    return { app, auth, call };
  };
  const owner = client('owner');
  const outsider = client('outsider');
  try {
    await assert.rejects(owner.call({ operation: 'load' }), /Sign in with Google/);
    await signInAnonymously(outsider.auth);
    await assert.rejects(outsider.call({ operation: 'load' }), /Sign in with Google/);
    const identity = `sushi-${Date.now()}`;
    const credential = GoogleAuthProvider.credential(
      JSON.stringify({ sub: identity, email: `${identity}@example.test`, email_verified: true }),
    );
    await signInWithCredential(owner.auth, credential);
    const uid = owner.auth.currentUser!.uid;
    await assert.rejects(
      owner.call({
        operation: 'collect',
        expectedUid: 'previous-account',
        idempotencyKey: 'stale',
      }),
      /account changed/,
    );
    const before = Date.now();
    const loads = await Promise.all(
      Array.from({ length: 4 }, () => owner.call<SushiRestaurantState>({ operation: 'load' })),
    );
    assert.ok(loads.every((state) => state.id === uid && state.balanceUnits === 0));
    assert.equal(new Set(loads.map((state) => state.createdAtMs)).size, 1);
    assert.ok(loads[0].createdAtMs >= before && loads[0].createdAtMs <= Date.now());
    const ref = adminDb.doc(`users/${uid}/sushi/restaurant`);
    for (const injected of [
      { uid: 'victim' },
      { nowMs: Date.now() + 1e12 },
      { initialGrants: ['prep_counter'] },
      { balanceUnits: 1e12 },
    ]) {
      await assert.rejects(
        owner.call({ operation: 'load', ...injected }),
        /determined by the server/,
      );
    }
    // Persist study progress through the same client/rules path as the study app.
    const db = getFirestore(owner.app);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    connectFirestoreEmulator(db, host, Number(port));
    const progress = createFreshCourseProgress();
    for (const lesson of [6, 7]) {
      const week = courseWeeks.find((week) => week.lessonNumber === lesson)!;
      for (const word of week.vocab) progress.masteredVocabIds[word.id] = true;
      for (const kanji of week.kanji) progress.masteredKanjiIds[kanji.id] = true;
      for (const verb of week.conjugations) progress.masteredDojoIds[verb.id] = true;
    }
    await setDoc(doc(db, 'users', uid, 'progress', 'course'), {
      payload: JSON.stringify(progress),
      updatedAt: 1,
    });
    const granted = await owner.call<SushiRestaurantState>({ operation: 'load' });
    assert.ok(granted.permanentGrants.includes('prep_counter'));
    assert.ok(granted.permanentGrants.includes('cap_extension_12h'));
    await assert.rejects(
      setDoc(doc(db, 'users', uid, 'sushi', 'restaurant'), { balanceUnits: 1e12 }),
      /permission/i,
    );
    // Start at an exact stopped cap to avoid timing tolerance in the concurrency assertion.
    await ref.update({
      accountedAtMs: Date.now(),
      usedProductionMs: DEFAULT_CAP_MS,
      uncollectedUnits: 48_000_000,
      balanceUnits: 0,
    });
    const collections = await Promise.all(
      Array.from({ length: 6 }, () =>
        owner.call<CollectRevenueResult>({ operation: 'collect', idempotencyKey: 'same-request' }),
      ),
    );
    assert.equal(collections.filter((result) => !result.wasAlreadyProcessed).length, 1);
    assert.equal(
      collections.reduce((sum, result) => sum + result.collectedUnits, 0),
      48_000_000,
    );
    assert.equal((await ref.get()).data().balanceUnits, 48_000_000);
    const buys = await Promise.all(
      Array.from({ length: 4 }, () =>
        owner.call<PurchaseItemResult>({
          operation: 'purchase',
          itemId: 'prep_counter',
          idempotencyKey: 'buy-prep',
        }),
      ),
    );
    assert.ok(buys.every((result) => result.success));
    assert.equal(buys.filter((result) => result.success && !result.wasAlreadyProcessed).length, 1);
    const bought = (await ref.get()).data() as SushiRestaurantState;
    assert.equal(bought.balanceUnits, 45_000_000);
    assert.deepEqual(bought.inventory, ['prep_counter']);
    assert.equal(bought.kitchenCapacity, 3);
    // Cap upgrade only resumes future production; stopped hours are never credited retroactively.
    await ref.update({
      balanceUnits: 120_000_000,
      usedProductionMs: DEFAULT_CAP_MS,
      uncollectedUnits: 1234,
      accountedAtMs: Date.now() - 3_600_000,
    });
    const cap = await owner.call<PurchaseItemResult>({
      operation: 'purchase',
      itemId: 'cap_extension_12h',
      idempotencyKey: 'cap',
    });
    assert.ok(cap.success);
    if (cap.success) {
      assert.equal(cap.state.capMs, EXTENDED_CAP_MS);
      assert.equal(cap.state.usedProductionMs, DEFAULT_CAP_MS);
      assert.equal(cap.state.uncollectedUnits, 1234);
    }
    // A fresh session loads the persisted restaurant, independent of browser local storage.
    await signInWithCredential(outsider.auth, credential);
    const reloaded = await outsider.call<SushiRestaurantState>({ operation: 'load' });
    assert.equal(reloaded.balanceUnits, 12_000_000);
    assert.ok(reloaded.inventory.includes('cap_extension_12h'));
    await signInWithCredential(
      outsider.auth,
      GoogleAuthProvider.credential(
        JSON.stringify({
          sub: `${identity}-other`,
          email: 'other@example.test',
          email_verified: true,
        }),
      ),
    );
    const other = await outsider.call<SushiRestaurantState>({ operation: 'load' });
    assert.notEqual(other.id, uid);
    assert.equal(other.balanceUnits, 0);
    assert.deepEqual(other.permanentGrants, []);
    // Gold decorations and the silver recipe use the same authoritative purchase path.
    for (const week of courseWeeks.filter((week) => [6, 7, 9].includes(week.lessonNumber))) {
      for (const word of week.vocab) progress.masteredVocabIds[word.id] = true;
      for (const kanji of week.kanji) progress.masteredKanjiIds[kanji.id] = true;
      for (const verb of week.conjugations) progress.masteredDojoIds[verb.id] = true;
      progress.quizBestResults[week.id] = {
        score: week.quiz.length,
        total: week.quiz.length,
        completedAt: 1,
      };
    }
    await setDoc(doc(db, 'users', uid, 'progress', 'course'), {
      payload: JSON.stringify(progress),
      updatedAt: 2,
    });
    await ref.update({ balanceUnits: 600_000_000 });
    const equip = (slot: string, itemId: string | null, key: string) =>
      owner.call<import('../../src/course/sushi-game/types.ts').EquipDecorationResult>({
        operation: 'equip',
        slot,
        itemId,
        idempotencyKey: key,
      });
    assert.equal((await equip('wallSlot', 'paper_lantern', 'unowned')).success, false);
    for (const itemId of ['salmon_nigiri', 'paper_lantern', 'wave_print', 'potted_plant']) {
      assert.ok(
        (
          await owner.call<PurchaseItemResult>({
            operation: 'purchase',
            itemId,
            idempotencyKey: itemId,
          })
        ).success,
      );
    }
    const economyBefore = (await ref.get()).data();
    await assert.rejects(equip('free-slot', 'paper_lantern', 'bad-slot'), /fixed decoration slot/);
    await assert.rejects(
      owner.call({
        operation: 'equip',
        slot: 'wallSlot',
        itemId: 'paper_lantern',
        idempotencyKey: 'coords',
        x: 123,
      }),
      /determined by the server/,
    );
    assert.equal((await equip('floorSlot', 'paper_lantern', 'wrong-slot')).success, false);
    assert.ok((await equip('wallSlot', 'paper_lantern', 'place')).success);
    assert.ok((await equip('wallSlot', 'wave_print', 'replace')).success);
    assert.ok((await equip('wallSlot', 'paper_lantern', 'place')).success);
    assert.equal((await ref.get()).data().equipped.wallSlot, 'wave_print');
    assert.ok((await equip('floorSlot', 'potted_plant', 'plant')).success);
    assert.ok((await equip('wallSlot', null, 'clear')).success);
    const decorated = await owner.call<SushiRestaurantState>({ operation: 'load' });
    assert.deepEqual(decorated.equipped, { wallSlot: null, floorSlot: 'potted_plant' });
    assert.ok(decorated.inventory.includes('salmon_nigiri'));
    for (const key of [
      'balanceUnits',
      'periodStartMs',
      'kitchenCapacity',
      'serviceCapacity',
      'averageRevenuePerOrder',
      'capMs',
    ] as const)
      assert.equal(decorated[key], economyBefore[key]);
    const isolated = await outsider.call<SushiRestaurantState>({ operation: 'load' });
    assert.deepEqual(isolated.equipped, { wallSlot: null, floorSlot: null });

    // Optional projects use the same authenticated, server-priced atomic boundary.
    await assert.rejects(
      owner.call({
        operation: 'project',
        projectId: 'study_nook',
        idempotencyKey: 'spoof-price',
        priceUnits: 1,
      }),
      /determined by the server/,
    );
    await assert.rejects(
      owner.call({
        operation: 'project',
        projectId: '../invalid',
        idempotencyKey: 'invalid-project',
      }),
      /restaurant project ID/,
    );
    const lockedProject = await outsider.call<PurchaseRestaurantProjectResult>({
      operation: 'project',
      projectId: 'study_nook',
      idempotencyKey: 'locked-project',
    });
    assert.equal(lockedProject.success, false);
    if (!lockedProject.success) assert.equal(lockedProject.reason, 'PROJECT_LOCKED');
    await ref.update({ balanceUnits: 100_000 * 60_000 });
    const projects = await Promise.all(
      Array.from({ length: 4 }, () =>
        owner.call<PurchaseRestaurantProjectResult>({
          operation: 'project',
          projectId: 'study_nook',
          idempotencyKey: 'project-retry',
        }),
      ),
    );
    assert.ok(projects.every((result) => result.success));
    assert.equal(
      projects.filter((result) => result.success && !result.wasAlreadyProcessed).length,
      1,
    );
    const projected = (await ref.get()).data() as SushiRestaurantState;
    assert.deepEqual(projected.completedProjects, ['study_nook']);
    assert.equal(projected.balanceUnits, 40_000 * 60_000);
    assert.equal(projected.kitchenCapacity, decorated.kitchenCapacity);
    assert.equal(projected.serviceCapacity, decorated.serviceCapacity);
    assert.equal(projected.averageRevenuePerOrder, decorated.averageRevenuePerOrder);
    assert.equal(projected.capMs, decorated.capMs);
    const duplicateProject = await owner.call<PurchaseRestaurantProjectResult>({
      operation: 'project',
      projectId: 'study_nook',
      idempotencyKey: 'project-new-key',
    });
    assert.equal(duplicateProject.success, false);
    if (!duplicateProject.success) assert.equal(duplicateProject.reason, 'ALREADY_COMPLETED');

    // Persisted pre-audit restaurants settle old production before adopting new rates/caps.
    await ref.set({
      ...projected,
      balanceVersion: 1,
      kitchenCapacity: 4,
      serviceCapacity: 2,
      averageRevenuePerOrder: 10,
      inventory: ['prep_counter', 'precision_knife'],
      permanentGrants: ['prep_counter', 'precision_knife'],
      balanceUnits: 0,
      uncollectedUnits: 13,
      usedProductionMs: 0,
      capMs: 8 * 3_600_000,
      accountedAtMs: Date.now() - 30 * 3_600_000,
      periodStartMs: Date.now() - 30 * 3_600_000,
    });
    const migrated = await owner.call<SushiRestaurantState>({ operation: 'load' });
    assert.equal(migrated.balanceVersion, 2);
    assert.equal(migrated.capMs, DEFAULT_CAP_MS);
    assert.equal(migrated.averageRevenuePerOrder, 11);
    assert.equal(migrated.usedProductionMs, 8 * 3_600_000);
    assert.equal(migrated.uncollectedUnits, 20 * 8 * 60 * 60_000 + 13);
    const migratedAgain = await owner.call<SushiRestaurantState>({ operation: 'load' });
    assert.equal(
      migratedAgain.uncollectedUnits - migrated.uncollectedUnits,
      22 * (migratedAgain.accountedAtMs - migrated.accountedAtMs),
    );
    assert.equal(migratedAgain.averageRevenuePerOrder, 11);
    assert.equal(migratedAgain.balanceUnits, 0);
  } finally {
    await Promise.all(apps.map(deleteApp));
    await adminDb.terminate();
    await adminApp.deleteApp(admin);
  }
});
