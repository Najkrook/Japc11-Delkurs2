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

test('Ticket 11: Anonymous guest authentication enables multiplayer across clients with concurrent answers from 3 players', async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  const userIds = ['anon-host', 'anon-p1', 'anon-p2'];
  const apps = userIds.map((uid) =>
    initializeApp({ projectId: 'demo-japc11-delkurs2', apiKey: 'fake' }, `anon-rules-${uid}`),
  );
  const databases = apps.map((app, i) => {
    const database = getFirestore(app);
    connectFirestoreEmulator(database, host, Number(port), {
      mockUserToken: {
        sub: userIds[i],
        provider_id: 'anonymous',
        firebase: { sign_in_provider: 'anonymous' },
      },
    });
    return database;
  });

  const managers = databases.map(
    (database, i) =>
      new CourseArenaManager(
        () => createCloudArenaStore(database),
        undefined,
        async () => userIds[i],
      ),
  );

  // All 3 are unauthenticated students (guests)
  managers.forEach((m) => m.bindHost(null, () => {}));

  const [hostMgr, p1Mgr, p2Mgr] = managers;

  try {
    const room = await hostMgr.createRoom();
    assert.ok(room, hostMgr.getState().errorMessage);
    assert.equal(hostMgr.getState().localPlayerUid, 'anon-host');

    // Both p1 and p2 join via room code / ID
    assert.equal(await p1Mgr.joinRoomById(room.roomId), true, p1Mgr.getState().errorMessage);
    assert.equal(p1Mgr.getState().localPlayerUid, 'anon-p1');

    assert.equal(await p2Mgr.joinRoomById(room.roomId), true, p2Mgr.getState().errorMessage);
    assert.equal(p2Mgr.getState().localPlayerUid, 'anon-p2');

    // Host starts match
    await hostMgr.startMatch();
    assert.equal(hostMgr.getState().room!.status, 'question');

    // Sync room state
    await p1Mgr.joinRoomById(room.roomId);
    await p2Mgr.joinRoomById(room.roomId);

    const question = hostMgr.getState().room!.questions[0];
    const answer = question.answer;

    // Concurrently submit answers from all 3 players in the exact same millisecond
    await Promise.all([
      hostMgr.submitAnswer(answer),
      p1Mgr.submitAnswer(answer),
      p2Mgr.submitAnswer(answer),
    ]);

    const savedDoc = (await getDoc(doc(databases[0], 'courseRooms', room.roomId))).data()!;

    // Verify all 3 answers are recorded independently without conflicts
    assert.ok(savedDoc.roundAnswers['0']['anon-host'], 'host answer recorded');
    assert.ok(savedDoc.roundAnswers['0']['anon-p1'], 'p1 answer recorded');
    assert.ok(savedDoc.roundAnswers['0']['anon-p2'], 'p2 answer recorded');

    // Verify all 3 scores were awarded correctly
    assert.ok(savedDoc.players['anon-host'].score > 0, 'host scored');
    assert.ok(savedDoc.players['anon-p1'].score > 0, 'p1 scored');
    assert.ok(savedDoc.players['anon-p2'].score > 0, 'p2 scored');

    assert.equal(savedDoc.players['anon-host'].streak, 1);
    assert.equal(savedDoc.players['anon-p1'].streak, 1);
    assert.equal(savedDoc.players['anon-p2'].streak, 1);

    // Adversarial attempts by anonymous participant
    const p1Ref = doc(databases[1], 'courseRooms', room.roomId);
    await assert.rejects(
      updateDoc(p1Ref, { 'players.anon-host.score': 999999 }),
      /permission/i,
      'Participant cannot alter host score',
    );
    await assert.rejects(
      updateDoc(p1Ref, { 'roundAnswers.0.anon-host.choice': 'tampered' }),
      /permission/i,
      'Participant cannot alter host answer',
    );
    await assert.rejects(
      updateDoc(p1Ref, { status: 'waiting' }),
      /permission/i,
      'Participant cannot alter room status',
    );

    // Cleanup: leave room
    await p2Mgr.leaveRoom();
    await p1Mgr.leaveRoom();
    const afterLeaves = (await getDoc(doc(databases[0], 'courseRooms', room.roomId))).data()!;
    assert.equal(afterLeaves.players['anon-p2'], undefined);
    assert.equal(afterLeaves.players['anon-p1'], undefined);

    await hostMgr.leaveRoom();
    assert.equal((await getDoc(doc(databases[0], 'courseRooms', room.roomId))).exists(), false);
  } finally {
    managers.forEach((m) => m.dispose());
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
      mockUserToken: { sub: userIds[i], provider_id: 'anonymous' },
    });
    return database;
  });

  const [a, b] = databases.map(
    (database, i) =>
      new CourseArenaManager(
        () => createCloudArenaStore(database),
        undefined,
        async () => userIds[i],
      ),
  );

  a.bindHost(null, () => {});
  b.bindHost(null, () => {});

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
