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
  setLogLevel,
} from 'firebase/firestore';
import { createCloudArenaStore } from '../../src/course/multiplayer/arena-store.ts';
import { CourseArenaManager } from '../../src/course/multiplayer/arena-service.ts';

setLogLevel('silent'); // Rejected adversarial writes below are expected test results.

for (let run = 0; run < 5; run++) {
  test(
    `Firestore protects rooms and preserves concurrent answers from two clients (${run + 1}/5)`,
    { timeout: 30000 },
    async () => {
      assert.ok(
        process.env.FIRESTORE_EMULATOR_HOST,
        'Run with npm run test:rules; never against production',
      );
      const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
      const apps = ['host', 'member', 'outsider'].map((uid) =>
        initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, `rules-${uid}`),
      );
      const databases = apps.map((app, i) => {
        const database = getFirestore(app);
        connectFirestoreEmulator(database, host, Number(port), {
          mockUserToken: { sub: ['host', 'member', 'outsider'][i] },
        });
        return database;
      });
      const [a, b] = databases
        .slice(0, 2)
        .map((database) => new CourseArenaManager(() => createCloudArenaStore(database)));
      a.bindHost({ uid: 'host', displayName: 'Host' }, () => {});
      b.bindHost({ uid: 'member', displayName: 'Member' }, () => {});
      try {
        const room = await a.createRoom();
        assert.ok(room, a.getState().errorMessage);
        const outsiderRef = doc(databases[2], 'courseRooms', room.roomId);
        await assert.rejects(updateDoc(outsiderRef, { hostUid: 'outsider' }), /permission/i);
        await assert.rejects(updateDoc(outsiderRef, { status: 'question' }), /permission/i);
        await assert.rejects(
          updateDoc(outsiderRef, { 'players.host.score': 999999 }),
          /permission/i,
        );
        assert.equal(await b.joinRoomById(room.roomId), true, b.getState().errorMessage);
        const memberRef = doc(databases[1], 'courseRooms', room.roomId);
        await assert.rejects(updateDoc(memberRef, { status: 'question' }), /permission/i);
        await assert.rejects(updateDoc(memberRef, { 'players.host.score': 999 }), /permission/i);
        await a.startMatch();
        assert.equal(a.getState().room!.status, 'question', a.getState().errorMessage);
        assert.equal(await b.joinRoomById(room.roomId), true, b.getState().errorMessage);
        const answer = a.getState().room!.questions[0].answer;
        const now = Date.now();
        const started = a.getState().room!.roundStartedAt;
        await assert.rejects(
          updateDoc(memberRef, {
            'players.member.score': 1300,
            'players.member.streak': 1,
            'players.member.correctCount': 1,
            'roundAnswers.0.member': {
              choice: answer,
              correct: true,
              pointsAwarded: 1300,
              answeredAt: now,
              timeRemainingMs: 15000 - (now - started),
            },
          }),
          /permission/i,
          'a valid choice cannot be used to forge the points awarded',
        );
        await Promise.all([a.submitAnswer(answer), b.submitAnswer(answer)]);
        const saved = (await getDoc(doc(databases[0], 'courseRooms', room.roomId))).data()!;
        assert.ok(saved.roundAnswers['0'].host, a.getState().errorMessage);
        assert.ok(saved.roundAnswers['0'].member, b.getState().errorMessage);
        assert.ok(saved.players.host.score > 0);
        assert.ok(saved.players.member.score > 0);
        await assert.rejects(
          updateDoc(memberRef, { 'players.member.score': 999999 }),
          /permission/i,
        );
        await assert.rejects(
          updateDoc(memberRef, { 'roundAnswers.0.host.choice': 'tampered' }),
          /permission/i,
        );
        await b.leaveRoom();
        assert.equal(b.getState().room, null, b.getState().errorMessage);
        const left = (await getDoc(doc(databases[0], 'courseRooms', room.roomId))).data()!;
        assert.equal(left.players.member, undefined);
        await a.leaveRoom();
        assert.equal((await getDoc(doc(databases[0], 'courseRooms', room.roomId))).exists(), false);
      } finally {
        a.dispose();
        b.dispose();
        await Promise.all(apps.map(deleteApp));
      }
    },
  );
}

test('Ticket 11: Unauthenticated requests cannot read, create or modify rooms in Firestore', async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  const unauthApp = initializeApp(
    { projectId: 'demo-japc11-delkurs2', apiKey: 'fake' },
    'unauth-test',
  );
  const unauthDb = getFirestore(unauthApp);
  connectFirestoreEmulator(unauthDb, host, Number(port)); // No mockUserToken -> request.auth == null
  try {
    const ref = doc(unauthDb, 'courseRooms', 'room-9999');
    await assert.rejects(getDoc(ref), /permission/i);
    await assert.rejects(
      setDoc(ref, {
        roomId: 'room-9999',
        roomCode: '9999',
        status: 'waiting',
        hostUid: 'anon',
        players: {},
        roundAnswers: {},
      }),
      /permission/i,
    );
  } finally {
    await deleteApp(unauthApp);
  }
});

test('Kurs-Arena is locked for anonymous Firebase sessions: they cannot read, create or join rooms', async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  const userIds = ['locked-host', 'locked-anon'];
  const apps = userIds.map((uid) =>
    initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, `locked-rules-${uid}`),
  );
  const [hostDb, anonDb] = apps.map((app, i) => {
    const database = getFirestore(app);
    connectFirestoreEmulator(database, host, Number(port), {
      mockUserToken:
        i === 0
          ? { sub: userIds[i] }
          : { sub: userIds[i], firebase: { sign_in_provider: 'anonymous', identities: {} } },
    });
    return database;
  });
  const hostMgr = new CourseArenaManager(() => createCloudArenaStore(hostDb));
  hostMgr.bindHost({ uid: 'locked-host', displayName: 'Host' }, () => {});
  try {
    const room = await hostMgr.createRoom();
    assert.ok(room, hostMgr.getState().errorMessage);
    const anonRef = doc(anonDb, 'courseRooms', room.roomId);
    await assert.rejects(getDoc(anonRef), /permission/i, 'anonymous users cannot read rooms');
    await assert.rejects(
      updateDoc(anonRef, {
        'players.locked-anon': {
          uid: 'locked-anon',
          name: 'Anon',
          avatar: 'x',
          score: 0,
          streak: 0,
          correctCount: 0,
          joinedAt: Date.now(),
        },
      }),
      /permission/i,
      'anonymous users cannot join rooms',
    );
    await assert.rejects(
      setDoc(doc(anonDb, 'courseRooms', 'room-8888'), {
        roomId: 'room-8888',
        roomCode: '8888',
        status: 'waiting',
        hostUid: 'locked-anon',
        players: { 'locked-anon': { uid: 'locked-anon' } },
        roundAnswers: {},
      }),
      /permission/i,
      'anonymous users cannot create rooms',
    );
    await hostMgr.leaveRoom();
  } finally {
    hostMgr.dispose();
    await Promise.all(apps.map(deleteApp));
  }
});

test('Ticket 11: Normal network latency and rounding buffer are accepted without permission-denied', async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  const userIds = ['latency-host', 'latency-member'];
  const apps = userIds.map((uid) =>
    initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, `latency-rules-${uid}`),
  );
  const databases = apps.map((app, i) => {
    const database = getFirestore(app);
    connectFirestoreEmulator(database, host, Number(port), {
      mockUserToken: { sub: userIds[i] },
    });
    return database;
  });

  const [a, b] = databases.map(
    (database) => new CourseArenaManager(() => createCloudArenaStore(database)),
  );

  a.bindHost({ uid: userIds[0], displayName: 'Host' }, () => {});
  b.bindHost({ uid: userIds[1], displayName: 'Member' }, () => {});

  try {
    const room = await a.createRoom();
    assert.ok(room);
    await b.joinRoomById(room.roomId);
    await a.startMatch();
    await b.joinRoomById(room.roomId);

    const answer = a.getState().room!.questions[0].answer;
    const memberRef = doc(databases[1], 'courseRooms', room.roomId);
    const roundStartedAt = a.getState().room!.roundStartedAt;
    const answeredAt = roundStartedAt + 5000;
    const roundMs = 15000;
    // 300ms rounding/latency delta between calculated timeRemainingMs and exact subtraction
    const timeRemainingMs = 10000 - 300; // 9700ms (300ms delta, well within the 1000ms allowance)
    const pointsAwarded = 500 + Math.round((timeRemainingMs * 500) / roundMs);

    // This must succeed without permission-denied despite minor clock/rounding variance!
    await updateDoc(memberRef, {
      'players.latency-member.score': pointsAwarded,
      'players.latency-member.streak': 1,
      'players.latency-member.correctCount': 1,
      'roundAnswers.0.latency-member': {
        choice: answer,
        correct: true,
        pointsAwarded,
        timeRemainingMs,
        answeredAt,
      },
    });

    const saved = (await getDoc(doc(databases[0], 'courseRooms', room.roomId))).data()!;
    assert.equal(saved.roundAnswers['0']['latency-member'].correct, true);
    assert.equal(saved.players['latency-member'].score, pointsAwarded);
  } finally {
    a.dispose();
    b.dispose();
    await Promise.all(apps.map(deleteApp));
  }
});
