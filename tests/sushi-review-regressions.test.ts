import test from 'node:test';
import assert from 'node:assert/strict';
import { SushiClientController } from '../src/course/sushi-game/sushi-view.ts';
import { InMemorySushiRepository, sushiService } from '../src/course/sushi-game/service.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import type { CourseHostContext } from '../src/course/types.ts';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const host = { render() {} } as CourseHostContext;

test('offline study writes time out instead of leaving loading stuck, then retry succeeds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  sushiService.setRepository(new InMemorySushiRepository());
  const controller = new SushiClientController();
  const syncHost = { ...host, ensureCourseSynced: () => new Promise<void>(() => {}) };
  try {
    controller.init('offline-study', syncHost);
    await flush();
    assert.equal(controller.loading, true);
    t.mock.timers.tick(15_000);
    await flush();
    assert.equal(controller.loading, false);
    assert.ok(controller.error);
    assert.equal(controller.state, null);
    syncHost.ensureCourseSynced = async () => {};
    controller.retry();
    await flush();
    assert.equal(controller.error, null);
    assert.equal(controller.state?.id, 'offline-study');
  } finally {
    controller.reset();
  }
});

test('medal sync counts elapsed time once in the displayed income', async () => {
  const previousNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  sushiService.setRepository(new InMemorySushiRepository());
  const controller = new SushiClientController();
  try {
    controller.init('review-medal', host);
    await flush();
    now += 60_000;
    const progress = createFreshCourseProgress();
    const chapter = courseWeeks.find((week) => week.lessonNumber === 6)!;
    for (const word of chapter.vocab) progress.masteredVocabIds[word.id] = true;
    for (const kanji of chapter.kanji) progress.masteredKanjiIds[kanji.id] = true;
    for (const verb of chapter.conjugations) progress.masteredDojoIds[verb.id] = true;
    controller.init('review-medal', host, progress);
    await flush();
    assert.ok(controller.state?.permanentGrants.includes('prep_counter'));
    assert.equal(controller.recalculate().displayedUncollectedYen, 10);
  } finally {
    controller.reset();
    Date.now = previousNow;
  }
});

test('failed initial load can be retried and never exposes a substitute restaurant', async () => {
  const repo = new InMemorySushiRepository();
  const transaction = repo.transaction.bind(repo);
  let attempts = 0;
  repo.transaction = async (...args) => {
    attempts++;
    if (attempts === 1) throw new Error('Network unavailable');
    return transaction(...args);
  };
  sushiService.setRepository(repo);
  const controller = new SushiClientController();
  try {
    controller.init('review-retry', host);
    await flush();
    assert.ok(controller.error);
    assert.equal(controller.state, null);
    controller.retry();
    await flush();
    assert.equal(attempts, 2);
    assert.equal(controller.error, null);
    assert.equal(controller.state?.id, 'review-retry');
  } finally {
    controller.reset();
  }
});

test('failed collection keeps the display clock and can retry the same request', async () => {
  const previousNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);
  const controller = new SushiClientController();
  try {
    controller.init('collect-retry', host);
    await flush();
    now += 60_000;
    const transaction = repo.transaction.bind(repo);
    repo.transaction = async () => {
      now += 60_000;
      throw new Error('Offline');
    };
    await controller.collect();
    assert.ok(controller.error);
    assert.equal(controller.state?.balanceUnits, 0);
    assert.equal(controller.recalculate().displayedUncollectedYen, 20);
    repo.transaction = transaction;
    await controller.collect();
    assert.equal(controller.error, null);
    assert.equal(controller.state?.balanceUnits, 1_200_000);
  } finally {
    controller.reset();
    Date.now = previousNow;
  }
});

test('late response from a previous session cannot overwrite the same user after re-entry', async () => {
  const previousNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  const repo = new InMemorySushiRepository();
  const transaction = repo.transaction.bind(repo);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  repo.transaction = async (...args) => {
    const delay = first;
    first = false;
    const result = await transaction(...args);
    if (delay) await held;
    return result;
  };
  sushiService.setRepository(repo);
  const controller = new SushiClientController();
  try {
    controller.init('alice', host);
    await flush();
    controller.reset();
    now = 5000;
    controller.init('alice', host);
    await flush();
    assert.equal(controller.state?.accountedAtMs, 5000);
    release();
    await flush();
    assert.equal(controller.state?.accountedAtMs, 5000);
  } finally {
    release();
    controller.reset();
    Date.now = previousNow;
  }
});
