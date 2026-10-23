import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
  deleteDoc,
  setLogLevel,
} from 'firebase/firestore';

setLogLevel('silent'); // Expected permission-denied errors should not pollute test output

test('Sushi Security Rules: Owner read allowed, cross-user and direct client writes denied', async () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    'Must run with npm run test:rules against local Firestore emulator',
  );
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');

  // Set up test apps with different identities
  const apps = {
    owner: initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, 'sushi-owner'),
    outsider: initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, 'sushi-outsider'),
    anonymous: initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, 'sushi-anon'),
    unauth: initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, 'sushi-unauth'),
  };

  const dbOwner = getFirestore(apps.owner);
  connectFirestoreEmulator(dbOwner, host, Number(port), {
    mockUserToken: { sub: 'student-owner', firebase: { sign_in_provider: 'google.com' } },
  });

  const dbOutsider = getFirestore(apps.outsider);
  connectFirestoreEmulator(dbOutsider, host, Number(port), {
    mockUserToken: { sub: 'student-outsider', firebase: { sign_in_provider: 'google.com' } },
  });

  const dbAnonymous = getFirestore(apps.anonymous);
  connectFirestoreEmulator(dbAnonymous, host, Number(port), {
    mockUserToken: { sub: 'anon-user', firebase: { sign_in_provider: 'anonymous' } },
  });

  const dbUnauth = getFirestore(apps.unauth);
  connectFirestoreEmulator(dbUnauth, host, Number(port)); // No mockUserToken -> request.auth == null

  const ownerRestaurantRef = doc(dbOwner, 'users', 'student-owner', 'sushi', 'restaurant');
  const outsiderTargetRef = doc(dbOutsider, 'users', 'student-owner', 'sushi', 'restaurant');
  const anonTargetRef = doc(dbAnonymous, 'users', 'student-owner', 'sushi', 'restaurant');
  const unauthTargetRef = doc(dbUnauth, 'users', 'student-owner', 'sushi', 'restaurant');

  try {
    // 1. Direct client creation by owner must fail
    await assert.rejects(
      setDoc(ownerRestaurantRef, {
        schemaVersion: 1,
        balanceUnits: 60000000,
        uncollectedUnits: 0,
      }),
      /permission/i,
      'Direct client setDoc must be denied even for the authenticated owner',
    );

    // 2. Direct client update by owner must fail
    await assert.rejects(
      updateDoc(ownerRestaurantRef, {
        balanceUnits: 99999999,
      }),
      /permission/i,
      'Direct client updateDoc must be denied even for the authenticated owner',
    );

    // 3. Direct client delete by owner must fail
    await assert.rejects(
      deleteDoc(ownerRestaurantRef),
      /permission/i,
      'Direct client deleteDoc must be denied even for the authenticated owner',
    );

    // 4. Outsider cannot read owner restaurant
    await assert.rejects(
      getDoc(outsiderTargetRef),
      /permission/i,
      'A different authenticated student cannot read another user sushi document',
    );

    // 5. Outsider cannot write to owner restaurant
    await assert.rejects(
      setDoc(outsiderTargetRef, { balanceUnits: 0 }),
      /permission/i,
      'Outsider cannot write to another user restaurant',
    );

    // 6. Anonymous session cannot read restaurant
    await assert.rejects(
      getDoc(anonTargetRef),
      /permission/i,
      'Anonymous user session cannot read restaurant',
    );

    // 7. Unauthenticated user cannot read restaurant
    await assert.rejects(
      getDoc(unauthTargetRef),
      /permission/i,
      'Unauthenticated request cannot read restaurant',
    );

    // 8. Owner read on their own document path is permitted
    // When read rule passes, getDoc resolves (even if doc does not exist yet: exists() === false)
    const ownerSnap = await getDoc(ownerRestaurantRef);
    assert.equal(ownerSnap.exists(), false, 'Owner read succeeds; document does not exist yet');

    // 9. Client cannot create arbitrary documents in sushi subcollection
    const arbitrarySubRef = doc(dbOwner, 'users', 'student-owner', 'sushi', 'hacked_document');
    await assert.rejects(
      setDoc(arbitrarySubRef, { hacked: true }),
      /permission/i,
      'Direct client writes to any document in /sushi/* are denied',
    );
  } finally {
    await Promise.all(Object.values(apps).map(deleteApp));
  }
});
