import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  setLogLevel,
} from 'firebase/firestore';
import {
  FirestoreSushiRepository,
  SushiService,
} from '../../src/course/sushi-game/service.ts';

setLogLevel('silent');

test('FirestoreSushiRepository: Behavior under Firestore Security Rules (Direct Client Write Denial)', async () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    'Must run with npm run test:rules against local Firestore emulator',
  );
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');

  const app = initializeApp(
    { projectId: 'demo-japc11-delkurs2', apiKey: 'fake' },
    'sushi-repo-test-owner',
  );

  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port), {
    mockUserToken: { sub: 'student-service-user', firebase: { sign_in_provider: 'google.com' } },
  });

  const repo = new FirestoreSushiRepository(db);
  const service = new SushiService(repo);

  try {
    // Under firestore.rules, allow write: if false denies direct client writes.
    // If FirestoreSushiRepository is instantiated in the client, getOrInitRestaurant will fail
    // when attempting to set the document.
    await assert.rejects(
      service.getOrInitRestaurant('student-service-user', 1000),
      /permission/i,
      'Direct client SDK execution of FirestoreSushiRepository must be denied by security rules',
    );
  } finally {
    await deleteApp(app);
  }
});
