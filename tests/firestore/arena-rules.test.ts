import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
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
