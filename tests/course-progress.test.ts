import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCourseProgress,
  type CourseProgressPersistence,
} from '../src/course/course-progress.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import type { CourseProgressData } from '../src/course/types.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

class MemoryPersistence implements CourseProgressPersistence {
  local = new Map<string | null, CourseProgressData>();
  reads: { uid: string; result: ReturnType<typeof deferred<CourseProgressData | null>> }[] = [];
  writes: { uid: string; data: CourseProgressData; done: ReturnType<typeof deferred<void>> }[] = [];
  readLocal(uid: string | null) {
    return structuredClone(this.local.get(uid) ?? createFreshCourseProgress());
  }
  writeLocal(uid: string | null, data: CourseProgressData) {
    this.local.set(uid, structuredClone(data));
  }
  readCloud(uid: string) {
    const result = deferred<CourseProgressData | null>();
    this.reads.push({ uid, result });
    return result.promise;
  }
  writeCloud(uid: string, data: CourseProgressData) {
    const done = deferred<void>();
    this.writes.push({ uid, data: structuredClone(data), done });
    return done.promise;
  }
}

// Drain promise continuations without wall-clock sleeps or timers.
async function drain() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
function setup() {
  const storage = new MemoryPersistence();
  const resets: (string | undefined)[] = [];
  const progress = createCourseProgress(
    storage,
    (week) => resets.push(week),
    () => 100,
  );
  return { storage, resets, progress };
}

test('restaurant sync waits for hydration and all queued study writes', async () => {
  const { progress, storage } = setup();
  void progress.useUser('alice');
  let synced = false;
  const barrier = progress.ensureCloudSynced('alice').then(() => {
    synced = true;
  });
  await drain();
  progress.update({ type: 'mastery', kind: 'vocab', id: 'one', mastered: true });
  storage.reads[0].result.resolve(null);
  await drain();
  assert.equal(synced, false);
  progress.update({ type: 'mastery', kind: 'kanji', id: 'two', mastered: true });
  storage.writes[0].done.resolve();
  await drain();
  assert.equal(synced, false);
  assert.equal(storage.writes[1].data.masteredKanjiIds.two, true);
  storage.writes[1].done.resolve();
  await barrier;
  assert.equal(synced, true);
});

test('restaurant sync reports failed writes and can explicitly retry without losing study data', async () => {
  const { progress, storage } = setup();
  void progress.useUser('alice');
  const barrier = progress.ensureCloudSynced('alice');
  const failure = assert.rejects(barrier, /could not be saved/);
  await drain();
  progress.update({ type: 'mastery', kind: 'vocab', id: 'one', mastered: true });
  storage.reads[0].result.resolve(null);
  await drain();
  storage.writes[0].done.reject(new Error('Offline'));
  await failure;
  assert.equal(progress.snapshot().masteredVocabIds.one, true);
  const retry = progress.ensureCloudSynced('alice');
  await drain();
  storage.writes[1].done.resolve();
  await retry;
  const wrongUser = progress.ensureCloudSynced('bob');
  await assert.rejects(wrongUser, /Account changed/);
});

test('hydration replays local additions, removals, navigation and quiz over newer cloud data before uploading', async () => {
  const { storage, progress, resets } = setup();
  const load = progress.useUser('alice');
  await drain();
  progress.update({ type: 'mastery', kind: 'vocab', id: 'local', mastered: true });
  progress.update({ type: 'mastery', kind: 'kanji', id: 'removed', mastered: false });
  progress.update({ type: 'week', weekId: 'week-2' });
  progress.update({ type: 'subview', subView: 'dojo' });
  progress.update({ type: 'quiz', weekId: 'week-2', score: 4, total: 10 });
  assert.equal(storage.writes.length, 0);
  const cloud = {
    ...createFreshCourseProgress(),
    updatedAt: 1000,
    masteredVocabIds: { remote: true },
    masteredKanjiIds: { removed: true },
    quizBestResults: { 'week-2': { score: 8, total: 10, completedAt: 999 } },
  };
  storage.reads[0].result.resolve(cloud);
  await load;
  await drain();
  const result = progress.snapshot();
  assert.deepEqual(result.masteredVocabIds, { remote: true, local: true });
  assert.deepEqual(result.masteredKanjiIds, {});
  assert.equal(result.activeWeekId, 'week-2');
  assert.equal(result.activeSubView, 'dojo');
  assert.equal(result.quizBestResults['week-2'].score, 8);
  assert.ok(result.updatedAt > cloud.updatedAt);
  assert.deepEqual(storage.writes[0].data, result);
  assert.deepEqual(storage.local.get('alice'), result);
  assert.deepEqual(resets, [undefined, 'week-2']);
});

test('a subscription registered after loading starts still receives hydrated progress, without timestamp inflation', async () => {
  const { progress, storage, resets } = setup();
  const load = progress.useUser('alice');
  await drain();
  let renders = 0;
  const unsubscribe = progress.subscribe(() => renders++);
  const duplicateLoad = progress.useUser('alice');
  assert.equal(storage.reads.length, 1);
  storage.reads[0].result.resolve({
    ...createFreshCourseProgress(),
    activeWeekId: 'week-3',
    updatedAt: 42,
  });
  await Promise.all([load, duplicateLoad]);
  assert.equal(renders, 1);
  assert.equal(progress.snapshot().updatedAt, 42);
  assert.equal(storage.local.get('alice')?.updatedAt, 42);
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(resets, [undefined, 'week-3']);
  unsubscribe();
  progress.update({ type: 'subview', subView: 'vocab' });
  assert.equal(renders, 1);
});

test('A to B to A ignores stale reads even when the uid matches again; guest remains isolated', async () => {
  const { progress, storage } = setup();
  progress.update({ type: 'mastery', kind: 'vocab', id: 'guest', mastered: true });
  const a1 = progress.useUser('alice');
  await drain();
  const b = progress.useUser('bob');
  await drain();
  const a2 = progress.useUser('alice');
  await drain();
  storage.reads[2].result.resolve({
    ...createFreshCourseProgress(),
    updatedAt: 20,
    masteredVocabIds: { alice: true },
  });
  await a2;
  storage.reads[0].result.resolve({
    ...createFreshCourseProgress(),
    updatedAt: 999,
    masteredVocabIds: { stale: true },
  });
  storage.reads[1].result.resolve({
    ...createFreshCourseProgress(),
    updatedAt: 999,
    masteredVocabIds: { bob: true },
  });
  await Promise.all([a1, b]);
  assert.deepEqual(progress.snapshot().masteredVocabIds, { alice: true });
  assert.equal(storage.local.has('bob'), false);
  assert.equal(storage.writes.length, 0);
  await progress.useUser(null);
  assert.deepEqual(progress.snapshot().masteredVocabIds, { guest: true });
});

test('cloud writes are ordered immutable snapshots and returning to a user waits for queued writes', async () => {
  const { progress, storage } = setup();
  const initial = progress.useUser('alice');
  await drain();
  storage.reads[0].result.resolve(createFreshCourseProgress());
  await initial;
  progress.update({ type: 'mastery', kind: 'dojo', id: 'a', mastered: true });
  progress.update({ type: 'mastery', kind: 'dojo', id: 'a', mastered: false });
  await drain();
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(storage.writes[0].data.masteredDojoIds, { a: true });
  await progress.useUser(null);
  const returning = progress.useUser('alice');
  await drain();
  assert.equal(storage.reads.length, 1);
  storage.writes[0].done.resolve();
  await drain();
  assert.equal(storage.writes.length, 2);
  assert.deepEqual(storage.writes[1].data.masteredDojoIds, {});
  assert.equal(storage.reads.length, 1);
  storage.writes[1].done.resolve();
  await drain();
  assert.equal(storage.reads.length, 2);
  storage.reads[1].result.resolve(storage.writes[1].data);
  await returning;
  assert.deepEqual(progress.snapshot().masteredDojoIds, {});
});

test('failed cloud reads never upload; retry preserves local edits and merges remote progress', async () => {
  const { progress, storage } = setup();
  const load = progress.useUser('alice');
  await drain();
  progress.update({ type: 'mastery', kind: 'vocab', id: 'local', mastered: true });
  storage.reads[0].result.reject(new Error('offline'));
  await load;
  progress.update({ type: 'mastery', kind: 'kanji', id: 'later', mastered: true });
  await drain();
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.local.get('alice')?.masteredKanjiIds.later, true);
  assert.equal(storage.reads.length, 2, 'the next edit retries a failed read automatically');
  const retry = progress.useUser('alice');
  await drain();
  storage.reads[1].result.resolve({
    ...createFreshCourseProgress(),
    updatedAt: 1000,
    masteredVocabIds: { remote: true },
  });
  await retry;
  await drain();
  assert.deepEqual(progress.snapshot().masteredVocabIds, { local: true, remote: true });
  assert.equal(progress.snapshot().masteredKanjiIds.later, true);
  assert.equal(storage.writes.length, 1);
});

test('absent cloud profile receives local progress; snapshots cannot mutate owned state', async () => {
  const { progress, storage } = setup();
  const load = progress.useUser('alice');
  await drain();
  storage.reads[0].result.resolve(null);
  await load;
  await drain();
  assert.equal(storage.writes.length, 1);
  const snapshot = progress.snapshot();
  snapshot.masteredVocabIds.accidental = true;
  snapshot.activeWeekId = 'week-4';
  assert.equal(progress.snapshot().masteredVocabIds.accidental, undefined);
  assert.equal(progress.snapshot().activeWeekId, 'week-1');
});

test('failed cloud read followed by offline edits merges cloud progress when cloud updatedAt is older than offline edit', async () => {
  let currentTime = 500;
  const storage = new MemoryPersistence();
  const progress = createCourseProgress(
    storage,
    () => {},
    () => currentTime,
  );
  const load = progress.useUser('alice');
  await drain();
  storage.reads[0].result.reject(new Error('offline'));
  await load;
  // Local edit happens at currentTime = 500
  progress.update({ type: 'mastery', kind: 'vocab', id: 'local-offline', mastered: true });
  await drain();
  // Cloud snapshot has updatedAt = 200 (older than local-offline at 500, but newer than baseline at 0)
  const retry = progress.useUser('alice');
  await drain();
  storage.reads[1].result.resolve({
    ...createFreshCourseProgress(),
    updatedAt: 200,
    masteredVocabIds: { remote: true },
  });
  await retry;
  await drain();
  assert.deepEqual(progress.snapshot().masteredVocabIds, { remote: true, 'local-offline': true });
  assert.equal(storage.writes.length, 1);
});

test('useUser(null) and switching users synchronously notifies subscribers', async () => {
  const { progress } = setup();
  let notifications = 0;
  progress.subscribe(() => notifications++);
  void progress.useUser('alice');
  assert.equal(notifications, 1);
  await progress.useUser(null);
  assert.equal(notifications, 2);
  void progress.useUser('bob');
  assert.equal(notifications, 3);
});
