import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRoute,
  formatRoute,
  normalizeHash,
  CourseRouter,
  type CourseRouterProgressStore,
  type CourseRouterArenaManager,
} from '../src/course/router.ts';
import type { CourseSubView } from '../src/course/types.ts';

test('Router: parseRoute correctly parses course week and subviews', () => {
  assert.deepEqual(parseRoute(''), { weekId: 'week-1', subView: 'hub' });
  assert.deepEqual(parseRoute('#'), { weekId: 'week-1', subView: 'hub' });
  assert.deepEqual(parseRoute('#/'), { weekId: 'week-1', subView: 'hub' });
  assert.deepEqual(parseRoute('#/vecka/week-1'), { weekId: 'week-1', subView: 'hub' });
  assert.deepEqual(parseRoute('#/vecka/week-2'), { weekId: 'week-2', subView: 'hub' });
  assert.deepEqual(parseRoute('#/vecka/week-2/dojo'), { weekId: 'week-2', subView: 'dojo' });
  assert.deepEqual(parseRoute('#/vecka/week-3/vocab'), { weekId: 'week-3', subView: 'vocab' });
  assert.deepEqual(parseRoute('#/vecka/week-4/kanji'), { weekId: 'week-4', subView: 'kanji' });
  assert.deepEqual(parseRoute('#/vecka/week-1/grammar'), { weekId: 'week-1', subView: 'grammar' });
  assert.deepEqual(parseRoute('#/vecka/week-1/quiz'), { weekId: 'week-1', subView: 'quiz' });
});

test('Router: parseRoute handles aliases (Swedish terms, short numbers, standalone views)', () => {
  assert.deepEqual(parseRoute('#/vecka/2/dojo'), { weekId: 'week-2', subView: 'dojo' });
  assert.deepEqual(parseRoute('#/vecka/3'), { weekId: 'week-3', subView: 'hub' });
  assert.deepEqual(parseRoute('#/vecka/week-1/glosor'), { weekId: 'week-1', subView: 'vocab' });
  assert.deepEqual(parseRoute('#/vecka/week-1/grammatik'), {
    weekId: 'week-1',
    subView: 'grammar',
  });
  assert.deepEqual(parseRoute('#/vecka/week-1/tenta'), { weekId: 'week-1', subView: 'quiz' });
  assert.deepEqual(parseRoute('#/glosor', 'week-3'), { weekId: 'week-3', subView: 'vocab' });
  assert.deepEqual(parseRoute('#/dojo', 'week-2'), { weekId: 'week-2', subView: 'dojo' });
});

test('Router: parseRoute handles arena, arena room codes, and extra studies', () => {
  assert.deepEqual(parseRoute('#/arena'), { weekId: 'week-1', subView: 'arena' });
  assert.deepEqual(parseRoute('#/arena/1234'), {
    weekId: 'week-1',
    subView: 'arena',
    arenaRoomCode: '1234',
  });
  assert.deepEqual(parseRoute('#/arena/room-9876'), {
    weekId: 'week-1',
    subView: 'arena',
    arenaRoomCode: '9876',
  });
  assert.deepEqual(parseRoute('#/extra'), { weekId: 'week-1', subView: 'extra' });
  assert.deepEqual(parseRoute('#/sushi'), { weekId: 'week-1', subView: 'sushi' });
  assert.deepEqual(parseRoute('#/restaurang', 'week-3'), { weekId: 'week-3', subView: 'sushi' });
  assert.deepEqual(parseRoute('#/sushigame', 'week-4'), { weekId: 'week-4', subView: 'sushi' });
});

test('Router: formatRoute produces canonical hash strings', () => {
  assert.equal(formatRoute({ weekId: 'week-1', subView: 'hub' }), '#/vecka/week-1');
  assert.equal(formatRoute({ weekId: 'week-2', subView: 'dojo' }), '#/vecka/week-2/dojo');
  assert.equal(formatRoute({ weekId: 'week-3', subView: 'vocab' }), '#/vecka/week-3/vocab');
  assert.equal(formatRoute({ weekId: 'week-4', subView: 'kanji' }), '#/vecka/week-4/kanji');
  assert.equal(formatRoute({ weekId: 'week-1', subView: 'grammar' }), '#/vecka/week-1/grammar');
  assert.equal(formatRoute({ weekId: 'week-1', subView: 'quiz' }), '#/vecka/week-1/quiz');
  assert.equal(formatRoute({ weekId: 'week-1', subView: 'extra' }), '#/extra');
  assert.equal(formatRoute({ weekId: 'week-3', subView: 'sushi' }), '#/sushi');
  assert.equal(formatRoute({ weekId: 'week-1', subView: 'arena' }), '#/arena');
  assert.equal(
    formatRoute({ weekId: 'week-1', subView: 'arena', arenaRoomCode: '5678' }),
    '#/arena/5678',
  );
});

test('Router: normalizeHash maps raw or alias URLs to canonical hashes', () => {
  assert.equal(normalizeHash(''), '#/vecka/week-1');
  assert.equal(normalizeHash('#/vecka/2/dojo'), '#/vecka/week-2/dojo');
  assert.equal(normalizeHash('#/glosor', 'week-2'), '#/vecka/week-2/vocab');
  assert.equal(normalizeHash('#/arena/room-4444'), '#/arena/4444');
  assert.equal(normalizeHash('#/extra'), '#/extra');
  assert.equal(normalizeHash('#/sushi'), '#/sushi');
  assert.equal(normalizeHash('#/restaurang'), '#/sushi');
});

interface MockWindow {
  location: { hash: string };
  history: {
    replaceState: (data: unknown, unused: string, url: string) => void;
  };
  listeners: Record<string, (() => void)[]>;
  addEventListener: (event: string, fn: () => void) => void;
  removeEventListener: (event: string, fn: () => void) => void;
  trigger: (event: string) => void;
}

function createMockWindow(initialHash = ''): MockWindow {
  const listeners: Record<string, (() => void)[]> = {};
  const win: MockWindow = {
    location: { hash: initialHash },
    history: {
      replaceState(_data, _unused, url) {
        win.location.hash = url;
      },
    },
    listeners,
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((l) => l !== fn);
    },
    trigger(event) {
      (listeners[event] || []).forEach((fn) => fn());
    },
  };
  return win;
}

function createMockStores(initialWeek = 'week-1', initialSubView: CourseSubView = 'hub') {
  let activeWeekId = initialWeek;
  let activeSubView = initialSubView;
  const progressListeners = new Set<() => void>();
  const arenaListeners = new Set<() => void>();

  let joinCodeInput = '';
  let room: { roomCode: string } | null = null;

  const progress: CourseRouterProgressStore = {
    snapshot: () => ({ activeWeekId, activeSubView }),
    update(cmd) {
      if (cmd.type === 'week') activeWeekId = cmd.weekId;
      if (cmd.type === 'subview') activeSubView = cmd.subView;
      progressListeners.forEach((l) => l());
    },
    subscribe(fn) {
      progressListeners.add(fn);
      return () => progressListeners.delete(fn);
    },
  };

  const arenaManager: CourseRouterArenaManager = {
    getState: () => ({ room, joinCodeInput }),
    setJoinCodeInput(code: string) {
      joinCodeInput = code;
      arenaListeners.forEach((l) => l());
    },
    leaveRoom: async () => {
      room = null;
      arenaListeners.forEach((l) => l());
    },
    onStateChange(fn) {
      arenaListeners.add(fn);
      return () => arenaListeners.delete(fn);
    },
  };

  return {
    progress,
    arenaManager,
    setRoom(r: { roomCode: string } | null) {
      room = r;
      arenaListeners.forEach((l) => l());
    },
  };
}

test('Router: CourseRouter initializes empty hash with canonical route', () => {
  const win = createMockWindow('');
  const { progress, arenaManager } = createMockStores('week-1', 'hub');

  const router = new CourseRouter({
    windowObj: win as unknown as Window,
    progress,
    arenaManager,
  });

  router.init();

  assert.equal(win.location.hash, '#/vecka/week-1');
  router.destroy();
});

test('Router: CourseRouter syncs initial hash into state on load', () => {
  const win = createMockWindow('#/vecka/week-2/dojo');
  const { progress, arenaManager } = createMockStores('week-1', 'hub');

  const router = new CourseRouter({
    windowObj: win as unknown as Window,
    progress,
    arenaManager,
  });

  router.init();

  assert.equal(progress.snapshot().activeWeekId, 'week-2');
  assert.equal(progress.snapshot().activeSubView, 'dojo');
  router.destroy();
});

test('Router: CourseRouter updates window.location.hash on state change', () => {
  const win = createMockWindow('#/vecka/week-1');
  const { progress, arenaManager } = createMockStores('week-1', 'hub');

  const router = new CourseRouter({
    windowObj: win as unknown as Window,
    progress,
    arenaManager,
  });

  router.init();

  // User clicks Dojo
  progress.update({ type: 'subview', subView: 'dojo' });
  assert.equal(win.location.hash, '#/vecka/week-1/dojo');

  // User switches to week 3
  progress.update({ type: 'week', weekId: 'week-3' });
  assert.equal(win.location.hash, '#/vecka/week-3/dojo');

  router.destroy();
});

test('Router: Back button (hashchange) navigates previous view without loop', () => {
  const win = createMockWindow('#/vecka/week-1');
  const { progress, arenaManager } = createMockStores('week-1', 'hub');

  const router = new CourseRouter({
    windowObj: win as unknown as Window,
    progress,
    arenaManager,
  });

  router.init();

  // Step 1: Navigate to Dojo
  progress.update({ type: 'subview', subView: 'dojo' });
  assert.equal(win.location.hash, '#/vecka/week-1/dojo');

  // Step 2: Navigate to Vocab
  progress.update({ type: 'subview', subView: 'vocab' });
  assert.equal(win.location.hash, '#/vecka/week-1/vocab');

  // Step 3: Simulate browser Back button (URL changes to Dojo, hashchange triggers)
  win.location.hash = '#/vecka/week-1/dojo';
  win.trigger('hashchange');

  assert.equal(progress.snapshot().activeSubView, 'dojo');
  assert.equal(win.location.hash, '#/vecka/week-1/dojo');

  // Step 4: Simulate browser Back button again to Hub
  win.location.hash = '#/vecka/week-1';
  win.trigger('hashchange');

  assert.equal(progress.snapshot().activeSubView, 'hub');
  assert.equal(win.location.hash, '#/vecka/week-1');

  router.destroy();
});

test('Router: Direct link to arena room pre-fills room code', () => {
  const win = createMockWindow('#/arena/4821');
  const { progress, arenaManager } = createMockStores('week-1', 'hub');

  const router = new CourseRouter({
    windowObj: win as unknown as Window,
    progress,
    arenaManager,
  });

  router.init();

  assert.equal(progress.snapshot().activeSubView, 'arena');
  assert.equal(arenaManager.getState().joinCodeInput, '4821');

  router.destroy();
});

test('Router: Entering arena room updates URL to #/arena/<code> and leaving restores #/arena', () => {
  const win = createMockWindow('#/arena');
  const { progress, arenaManager, setRoom } = createMockStores('week-1', 'arena');

  const router = new CourseRouter({
    windowObj: win as unknown as Window,
    progress,
    arenaManager,
  });

  router.init();

  assert.equal(win.location.hash, '#/arena');

  // Room created
  setRoom({ roomCode: '7391' });
  assert.equal(win.location.hash, '#/arena/7391');

  // Leave room
  setRoom(null);
  assert.equal(win.location.hash, '#/arena');

  router.destroy();
});
