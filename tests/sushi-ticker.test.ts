import test from 'node:test';
import assert from 'node:assert/strict';
import { SushiClientController } from '../src/course/sushi-game/sushi-view.ts';
import type { CourseHostContext } from '../src/course/types.ts';

function createMockHost(): CourseHostContext & { renderCalls: number } {
  const mock = {
    theme: 'classic' as const,
    toggleTheme: () => {},
    user: { uid: 'vis-user', displayName: 'Vis User' },
    authBusy: false,
    renderCalls: 0,
    get authError() {
      return null;
    },
    clearAuthError: () => {},
    get speechNotice() {
      return null;
    },
    clearSpeechNotice: () => {},
    account: () => {},
    onLogin: () => {},
    speak: (_text: string) => 'ok' as const,
    tts: true,
    get status() {
      return '';
    },
    render: () => {
      mock.renderCalls++;
    },
    announce: (_msg: string) => {},
  };
  return mock;
}

test('SushiClientController: 1Hz ticker suppresses re-renders in background tabs (document.visibilityState === "hidden")', async () => {
  let intervalCb: (() => void) | null = null;
  let clearedIntervalId: unknown = null;
  const eventListeners: Record<string, (() => void)[]> = {};

  const mockWindow = {
    setInterval: (cb: () => void, _delay: number) => {
      intervalCb = cb;
      return 9999 as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval: (id: unknown) => {
      clearedIntervalId = id;
    },
  };

  const mockDocument = {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener: (type: string, listener: () => void) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (eventListeners[type]) {
        eventListeners[type] = eventListeners[type].filter((l) => l !== listener);
      }
    },
  };

  const origWin = (globalThis as Record<string, unknown>).window;
  const origDoc = (globalThis as Record<string, unknown>).document;

  try {
    (globalThis as Record<string, unknown>).window = mockWindow;
    (globalThis as Record<string, unknown>).document = mockDocument;

    const controller = new SushiClientController();
    const host = createMockHost();

    controller.init('vis-user', host);
    assert.ok(intervalCb !== null, 'setInterval callback must be captured');

    // Wait a tick for async getOrInitRestaurant to finish so loading becomes false
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(controller.loading, false);

    const initialRenderCalls = host.renderCalls;

    // 1. Visible tab: ticker fires -> render() called
    mockDocument.visibilityState = 'visible';
    intervalCb!();
    assert.equal(host.renderCalls, initialRenderCalls + 1, 'Render must be called when tab is visible');

    // 2. Background tab: ticker fires -> render() suppressed
    mockDocument.visibilityState = 'hidden';
    intervalCb!();
    assert.equal(
      host.renderCalls,
      initialRenderCalls + 1,
      'Render must be suppressed when tab is in background (visibilityState === "hidden")',
    );

    // 3. User switches back to tab: visibilitychange event fires -> render() called
    mockDocument.visibilityState = 'visible';
    const visHandlers = eventListeners['visibilitychange'] || [];
    assert.ok(visHandlers.length > 0, 'visibilitychange handler must be attached');
    for (const h of visHandlers) h();
    assert.equal(
      host.renderCalls,
      initialRenderCalls + 2,
      'Switching back to visible must immediately trigger render()',
    );

    // 4. Reset clears timer and event listener
    controller.reset();
    assert.equal(clearedIntervalId, 9999, 'reset() must clear the ticker interval');
    assert.equal(eventListeners['visibilitychange']?.length, 0, 'reset() must clean up visibility listener');
  } finally {
    if (origWin !== undefined) {
      (globalThis as Record<string, unknown>).window = origWin;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    if (origDoc !== undefined) {
      (globalThis as Record<string, unknown>).document = origDoc;
    } else {
      delete (globalThis as Record<string, unknown>).document;
    }
  }
});
