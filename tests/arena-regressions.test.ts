import test from 'node:test';
import assert from 'node:assert/strict';
import { CourseArenaManager } from '../src/course/multiplayer/arena-service.ts';
import { localArenaStore } from '../src/course/multiplayer/arena-store.ts';
import {
  createFreshCourseProgress,
  selectLatestCourseProgress,
} from '../src/course/course-state.ts';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('two players keep both answers when their local room snapshots overlap', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  const a = new CourseArenaManager(() => localArenaStore);
  a.bindHost({ uid: 'player-a', displayName: 'A' }, () => {});
  const b = new CourseArenaManager(() => localArenaStore);
  b.bindHost({ uid: 'player-b', displayName: 'B' }, () => {});
  try {
    const room = await a.createRoom();
    assert.ok(room);
    await b.joinRoomById(room.roomId);
    await a.joinRoomById(room.roomId);
    await a.startMatch();
    await b.joinRoomById(room.roomId);
    const answer = a.getState().room!.questions[0].answer;
    await Promise.all([a.submitAnswer(answer), b.submitAnswer(answer)]);
    await a.joinRoomById(room.roomId);
    const answers = a.getState().room!.roundAnswers['0'];
    assert.ok(answers['player-a'], 'first answer must survive the second write');
    assert.ok(answers['player-b'], 'second answer must also be saved');
  } finally {
    await b.leaveRoom();
    await a.leaveRoom();
    a.dispose();
    b.dispose();
  }
});

test('logout restores the guest identity, closes the room and cancels old listeners', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  sessionStorage.setItem('tentaplugg-arena-guest-uid', 'guest-original');
  const manager = new CourseArenaManager(() => localArenaStore);
  try {
    manager.bindHost(null, () => {});
    manager.bindHost({ uid: 'account-user', displayName: 'Account name' }, () => {});
    const room = await manager.createRoom();
    assert.ok(room);
    manager.bindHost(null, () => {});
    assert.equal(manager.getState().localPlayerUid, 'guest-original');
    assert.equal(manager.getState().localPlayerName, 'Spelare');
    assert.equal(manager.getState().isLoggedIn, false);
    assert.equal(manager.getState().room, null);
    await localArenaStore.change(room.roomId, () => null);
  } finally {
    manager.dispose();
  }
});

test('a colliding room code never overwrites the existing room', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  const first = new CourseArenaManager(() => localArenaStore);
  const second = new CourseArenaManager(() => localArenaStore);
  first.bindHost({ uid: 'player-first' }, () => {});
  second.bindHost({ uid: 'player-second' }, () => {});
  const random = Math.random;
  try {
    Math.random = () => 0.25;
    const original = await first.createRoom();
    assert.ok(original);
    assert.equal(await second.createRoom(), null);
    assert.deepEqual(await localArenaStore.get(original.roomId), original);
    assert.match(second.getState().errorMessage, /ledig rumskod/);
  } finally {
    Math.random = random;
    await first.leaveRoom();
    first.dispose();
    second.dispose();
  }
});

test('duplicate answers award points once and leaving removes the participant', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  sessionStorage.setItem('tentaplugg-arena-guest-uid', 'guest-host');
  const host = new CourseArenaManager(() => localArenaStore);
  host.bindHost({ uid: 'player-host' }, () => {});
  const member = new CourseArenaManager(() => localArenaStore);
  member.bindHost({ uid: 'player-member' }, () => {});
  try {
    const room = await host.createRoom();
    assert.ok(room);
    await member.joinRoomById(room.roomId);
    await host.startMatch();
    const answer = host.getState().room!.questions[0].answer;
    await Promise.all([host.submitAnswer(answer), host.submitAnswer(answer)]);
    let saved = await localArenaStore.get(room.roomId);
    assert.equal(saved!.players['player-host'].correctCount, 1);
    assert.equal(
      saved!.players['player-host'].score,
      saved!.roundAnswers['0']['player-host'].pointsAwarded,
    );
    await member.leaveRoom();
    saved = await localArenaStore.get(room.roomId);
    assert.equal(saved!.players['player-member'], undefined);
  } finally {
    await host.leaveRoom();
    host.dispose();
    member.dispose();
  }
});

test('newer progress preserves removals and older cloud snapshots cannot undo local changes', () => {
  const local = createFreshCourseProgress();
  local.updatedAt = 10;
  local.masteredVocabIds.word = true;
  local.masteredKanjiIds.kanji = true;
  local.masteredDojoIds.verb = true;
  const cloud = createFreshCourseProgress();
  cloud.updatedAt = 20;
  const selected = selectLatestCourseProgress(local, cloud);
  assert.deepEqual(selected.masteredVocabIds, {});
  assert.deepEqual(selected.masteredKanjiIds, {});
  assert.deepEqual(selected.masteredDojoIds, {});
  assert.deepEqual(selectLatestCourseProgress(cloud, local), cloud);
  selected.masteredVocabIds.other = true;
  assert.deepEqual(cloud.masteredVocabIds, {}, 'selected state must not mutate the saved snapshot');
});

test('a participant cannot start another player’s match', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  sessionStorage.setItem('tentaplugg-arena-guest-uid', 'guest-host');
  const host = new CourseArenaManager(() => localArenaStore);
  host.bindHost({ uid: 'player-host' }, () => {});
  const member = new CourseArenaManager(() => localArenaStore);
  member.bindHost({ uid: 'player-member' }, () => {});
  try {
    const room = await host.createRoom();
    assert.ok(room);
    await member.joinRoomById(room.roomId);
    await member.startMatch();
    assert.equal(member.getState().room!.status, 'waiting');
  } finally {
    await member.leaveRoom();
    await host.leaveRoom();
    host.dispose();
    member.dispose();
  }
});

test('a logged-in user whose cloud write fails gets an error instead of a silent local room', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  const failingCloud = {
    get: async () => null,
    change: async () => {
      throw new Error('offline');
    },
    watch: () => () => {},
    watchOpen: () => () => {},
  };
  const manager = new CourseArenaManager((loggedIn) => (loggedIn ? failingCloud : localArenaStore));
  try {
    manager.bindHost({ uid: 'account-user', displayName: 'Account name' }, () => {});
    const room = await manager.createRoom();
    assert.equal(room, null);
    assert.equal(manager.getState().room, null);
    assert.ok(manager.getState().errorMessage, 'the user must be told the room was not saved');
  } finally {
    manager.dispose();
  }
});

test('Kurs-Arena is locked for guests: they cannot create or join rooms', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  const host = new CourseArenaManager(() => localArenaStore);
  const guest = new CourseArenaManager(() => localArenaStore);
  host.bindHost({ uid: 'account-host', displayName: 'Host' }, () => {});
  guest.bindHost(null, () => {});
  try {
    assert.equal(await guest.createRoom(), null, 'guests must not be able to create a room');
    assert.match(guest.getState().errorMessage, /Logga in/);
    assert.equal(guest.getState().room, null);

    const room = await host.createRoom();
    assert.ok(room);
    assert.equal(await guest.joinRoomById(room.roomId), false, 'guests must not join by id');
    assert.equal(await guest.joinRoomByCode(room.roomCode), false, 'guests must not join by code');
    const saved = await localArenaStore.get(room.roomId);
    assert.deepEqual(Object.keys(saved!.players), ['account-host']);
  } finally {
    await host.leaveRoom();
    host.dispose();
    guest.dispose();
  }
});
