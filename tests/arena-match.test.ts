import test from 'node:test';
import assert from 'node:assert/strict';
import { CourseArenaManager } from '../src/course/multiplayer/arena-service.ts';
import { ManualArenaRuntime, MemoryArenaStore, settle } from './helpers/arena-fixtures.ts';

function setup() {
  const clock = new ManualArenaRuntime();
  const store = new MemoryArenaStore();
  const host = new CourseArenaManager(() => store, clock);
  const member = new CourseArenaManager(() => store, clock);
  host.bindHost({ uid: 'host', displayName: 'Host' }, () => {});
  member.bindHost({ uid: 'member', displayName: 'Member' }, () => {});
  host.updateDraftConfig({ roundCount: 5 });
  return {
    clock,
    store,
    host,
    member,
    dispose: () => {
      host.dispose();
      member.dispose();
    },
  };
}

test('five rounds score speed/streak bonuses, finish using the actual deck length and restart cleanly', async (t) => {
  const { host, clock, dispose } = setup();
  t.after(dispose);
  const created = await host.createRoom();
  assert.equal(created?.status, 'waiting');
  await host.startMatch();
  assert.equal(host.getState().room!.questions.length, 5);
  const expectedPoints = [750, 850, 950, 1050, 0];
  for (let round = 0; round < 5; round++) {
    assert.equal(host.getState().room!.status, 'question');
    assert.equal(host.getState().room!.currentRoundIndex, round);
    await clock.advance(7500);
    assert.equal(host.getState().timeRemainingSeconds, 8);
    assert.equal(host.getState().timeRemainingRatio, 0.5);
    const q = host.getState().room!.questions[round];
    const choice = round < 4 ? q.answer : q.choices.find((c) => c !== q.answer)!;
    await host.submitAnswer(choice);
    await host.submitAnswer(choice);
    const room = host.getState().room!;
    assert.equal(room.status, 'reveal');
    assert.equal(room.roundAnswers[String(round)].host.pointsAwarded, expectedPoints[round]);
    assert.equal(room.players.host.streak, round < 4 ? round + 1 : 0);
    assert.equal(clock.pendingCount, 0);
    await host.nextRound();
  }
  const finished = host.getState().room!;
  assert.equal(finished.status, 'finished');
  assert.equal(finished.players.host.score, 3600);
  assert.equal(finished.players.host.correctCount, 4);
  await host.nextRound();
  assert.equal(host.getState().room!.currentRoundIndex, 4);
  await host.startMatch();
  assert.equal(host.getState().room!.status, 'question');
  assert.equal(host.getState().room!.currentRoundIndex, 0);
  assert.equal(host.getState().room!.players.host.score, 0);
  assert.equal(host.getState().room!.players.host.streak, 0);
  assert.deepEqual(host.getState().room!.roundAnswers, { '0': {} });
});

test('host reveals when all human players answered; participants cannot advance; deadline rejects late answers', async (t) => {
  const { host, member, clock, dispose } = setup();
  t.after(dispose);
  const created = await host.createRoom();
  await member.joinRoomById(created!.roomId);
  await host.startMatch();
  await settle();
  let q = host.getState().room!.questions[0];
  await host.submitAnswer(q.answer);
  await member.submitAnswer(q.answer);
  assert.equal(host.getState().room!.status, 'question');
  await clock.advance(250);
  assert.equal(host.getState().room!.status, 'reveal');
  assert.equal(member.getState().room!.status, 'reveal');
  await member.nextRound();
  assert.equal(member.getState().room!.currentRoundIndex, 0);
  await host.nextRound();
  await settle();
  await clock.advance(15000);
  assert.equal(host.getState().room!.status, 'reveal');
  assert.equal(clock.pendingCount, 0);
  q = host.getState().room!.questions[1];
  await member.submitAnswer(q.answer);
  assert.deepEqual(host.getState().room!.roundAnswers['1'], {});
  assert.equal(
    host.getState().room!.players.host.streak,
    1,
    'timeouts retain the existing streak policy',
  );
  assert.equal(host.getState().room!.players.member.score, 1000);
});

test('bot correct/wrong choices are deterministic, score once through transaction retries and cancel on reveal', async (t) => {
  const { host, clock, store, dispose } = setup();
  t.after(dispose);
  clock.randomValue = 0;
  store.retryTransitions = true;
  await host.createRoom(true);
  await host.startMatch();
  const oldTimers = clock.queuedCallbacks();
  const first = host.getState().room!.questions[0];
  await host.submitAnswer(first.answer);
  await clock.advance(1400);
  let room = host.getState().room!;
  assert.equal(room.status, 'reveal');
  assert.equal(room.roundAnswers['0']['bot-sakura'].correct, true);
  assert.equal(room.roundAnswers['0']['bot-sakura'].pointsAwarded, 953);
  assert.equal(room.players['bot-sakura'].correctCount, 1);
  assert.equal(room.players['bot-sakura'].streak, 1);
  assert.equal(clock.pendingCount, 0);
  await host.nextRound();
  const before = structuredClone(host.getState().room);
  oldTimers.forEach((callback) => callback());
  await settle();
  assert.deepEqual(host.getState().room, before, 'already queued old-round callbacks are harmless');
  clock.randomValue = 0.99;
  await host.submitAnswer(host.getState().room!.questions[1].answer);
  await clock.advance(1400);
  room = host.getState().room!;
  assert.equal(room.status, 'reveal');
  assert.equal(room.roundAnswers['1']['bot-sakura'].correct, false);
  assert.equal(room.roundAnswers['1']['bot-sakura'].pointsAwarded, 0);
  assert.equal(room.players['bot-sakura'].score, 953);
  assert.equal(room.players['bot-sakura'].streak, 0);
});

test('leaving removes listeners/timers; callbacks queued before leave cannot affect a replacement room', async (t) => {
  const { host, member, clock, store, dispose } = setup();
  t.after(dispose);
  clock.randomValue = 0;
  const created = await host.createRoom(true);
  await member.joinRoomById(created!.roomId);
  await host.startMatch();
  await settle();
  const oldCallbacks = clock.queuedCallbacks();
  await member.leaveRoom();
  await settle();
  assert.equal(host.getState().room!.players.member, undefined);
  await host.leaveRoom();
  await settle();
  assert.equal(clock.pendingCount, 0);
  assert.equal(store.listenerCount, 2, 'only open-room watchers remain');
  assert.equal(await store.get(created!.roomId), null);
  const replacement = await host.createRoom(true);
  assert.equal(
    replacement!.roomId,
    created!.roomId,
    'same code and time exercise lifecycle guards',
  );
  await host.startMatch();
  const before = structuredClone(host.getState().room);
  oldCallbacks.forEach((callback) => callback());
  await settle();
  assert.deepEqual(host.getState().room, before);
  dispose();
  assert.equal(clock.pendingCount, 0);
  assert.equal(store.listenerCount, 0);
});

test('identity changes invalidate old callbacks and subscriptions even after rebinding the original user', async (t) => {
  const { host, clock, store, dispose } = setup();
  t.after(dispose);
  const created = await host.createRoom(true);
  await host.startMatch();
  const oldCallbacks = clock.queuedCallbacks();
  host.bindHost({ uid: 'other-user' }, () => {});
  assert.equal(host.getState().room, null);
  assert.equal(clock.pendingCount, 0);
  host.bindHost({ uid: 'host' }, () => {});
  await host.joinRoomById(created!.roomId);
  const before = structuredClone(await store.get(created!.roomId));
  oldCallbacks.forEach((callback) => callback());
  await settle();
  assert.deepEqual(await store.get(created!.roomId), before);
  const callbacksBeforeDispose = clock.queuedCallbacks();
  host.dispose();
  callbacksBeforeDispose.forEach((callback) => callback());
  await settle();
  assert.deepEqual(await store.get(created!.roomId), before);
  assert.equal(clock.pendingCount, 0);
});

test('participant clock skew before roundStartedAt clamps answeredAt to roundStartedAt and maintains duration consistency', async (t) => {
  const { host, member, clock, dispose } = setup();
  t.after(dispose);
  const created = await host.createRoom();
  await member.joinRoomById(created!.roomId);
  await host.startMatch();
  await settle();
  const q = host.getState().room!.questions[0];
  const roundStartedAt = host.getState().room!.roundStartedAt;
  const originalNow = clock.now;
  clock.now = () => roundStartedAt - 50;
  await member.submitAnswer(q.answer);
  clock.now = originalNow;
  await settle();
  const answer = member.getState().room!.roundAnswers['0'].member;
  assert.ok(answer);
  assert.equal(answer.answeredAt, roundStartedAt);
  assert.equal(answer.timeRemainingMs, 15000);
});

test('redundant answer or no-op transition does not bump room updatedAt', async (t) => {
  const { host, clock, dispose } = setup();
  t.after(dispose);
  await host.createRoom();
  await host.startMatch();
  const q = host.getState().room!.questions[0];
  await host.submitAnswer(q.answer);
  const updatedAtAfterFirstAnswer = host.getState().room!.updatedAt;
  await clock.advance(500);
  // Duplicate answer
  await host.submitAnswer(q.answer);
  assert.equal(host.getState().room!.updatedAt, updatedAtAfterFirstAnswer);
});
