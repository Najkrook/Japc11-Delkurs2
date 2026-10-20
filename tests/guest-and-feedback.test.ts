import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderCourseArenaModule,
  renderArenaGuestBanner,
} from '../src/course/components/course-arena.ts';
import { renderCourseShell } from '../src/course/course-view.ts';
import { courseArenaManager } from '../src/course/multiplayer/arena-service.ts';
import { speak, resetVoiceForTesting } from '../src/speech.ts';
import type { CourseHostContext } from '../src/course/types.ts';

function renderTemplateToString(t: unknown): string {
  if (t === null || t === undefined || typeof t === 'boolean') return '';
  if (typeof t === 'string' || typeof t === 'number') return String(t);
  if (Array.isArray(t)) return t.map(renderTemplateToString).join('');
  if (
    typeof t === 'object' &&
    t &&
    'strings' in t &&
    Array.isArray((t as { strings: unknown }).strings)
  ) {
    const tmpl = t as { strings: string[]; values: unknown[] };
    let out = '';
    for (let i = 0; i < tmpl.strings.length; i++) {
      out += tmpl.strings[i];
      if (i < tmpl.values.length) {
        out += renderTemplateToString(tmpl.values[i]);
      }
    }
    return out;
  }
  return '';
}

function createMockHost(overrides: Partial<CourseHostContext> = {}): CourseHostContext {
  let status = 'Lokalt sparad';
  let authError: string | null = null;
  let speechNotice: string | null = null;

  const mock: CourseHostContext = {
    theme: 'classic',
    toggleTheme: () => {},
    user: null,
    authBusy: false,
    get authError() {
      return authError;
    },
    clearAuthError: () => {
      authError = null;
    },
    get speechNotice() {
      return speechNotice;
    },
    clearSpeechNotice: () => {
      speechNotice = null;
    },
    account: () => {},
    onLogin: () => {},
    speak: (_text: string) => 'ok',
    tts: true,
    get status() {
      return status;
    },
    render: () => {},
    announce: (msg: string) => {
      status = msg;
    },
    ...overrides,
  };

  if ('authError' in overrides) {
    authError = overrides.authError ?? null;
  }
  if ('speechNotice' in overrides) {
    speechNotice = overrides.speechNotice ?? null;
  }

  return mock;
}

test('Ticket 05: Arenans gästbanner och login-knapp renderas för utloggade användare och döljs vid inloggning', async () => {
  let loginCalled = false;
  const guestHost = createMockHost({
    user: null,
    onLogin: () => {
      loginCalled = true;
    },
  });

  try {
    // 1. Standalone banner component
    const bannerHtml = renderTemplateToString(renderArenaGuestBanner(guestHost));
    const normalizedBanner = bannerHtml.replace(/\s+/g, ' ');
    assert.ok(
      bannerHtml.includes('arena-guest-banner'),
      'Gästbannern ska ha css-klassen arena-guest-banner',
    );
    assert.ok(
      normalizedBanner.includes('Gästläge:') &&
        normalizedBanner.includes(
          'Detta rum körs lokalt i din webbläsare. För att spela i realtid mot kurskamrater på andra mobiler och datorer, logga in med Google.',
        ),
      'Gästbannern ska innehålla den specificerade förklaringen',
    );
    assert.ok(
      bannerHtml.includes('arena-guest-login-btn'),
      'Gästbannern ska ha en logga in-knapp med klass arena-guest-login-btn',
    );

    // 2. I lobbyn när ingen match pågår
    courseArenaManager.bindHost(null, () => {});
    const lobbyHtml = renderTemplateToString(renderCourseArenaModule(guestHost, () => {}));
    assert.ok(
      lobbyHtml.includes('arena-guest-banner'),
      'Gästbannern ska renderas i arenans lobby när användaren är gäst',
    );
    assert.ok(lobbyHtml.includes('Logga in'), 'Logga in-knappen ska renderas i lobbyn för gäster');

    // 3. I väntrummet när rum skapas
    await courseArenaManager.createRoom(false);
    const waitingHtml = renderTemplateToString(renderCourseArenaModule(guestHost, () => {}));
    assert.ok(
      waitingHtml.includes('arena-guest-banner'),
      'Gästbannern ska renderas i arenans väntrum när användaren är gäst',
    );
    await courseArenaManager.leaveRoom();

    // 4. När användaren är inloggad ska bannern inte visas
    const loggedInHost = createMockHost({
      user: { uid: 'u123', displayName: 'Tanaka', email: 'tanaka@example.com' },
    });
    const loggedInLobbyHtml = renderTemplateToString(
      renderCourseArenaModule(loggedInHost, () => {}),
    );
    assert.ok(
      !loggedInLobbyHtml.includes('arena-guest-banner'),
      'Gästbannern ska inte renderas när användaren är inloggad',
    );
  } finally {
    courseArenaManager.dispose();
  }
});

test('Ticket 05: Inloggningsfel renderas i direkt anslutning till kontoknappen i toppmenyn', () => {
  const hostWithError = createMockHost({
    authError: 'Inloggning avbröts',
  });

  const shellHtml = renderTemplateToString(renderCourseShell(hostWithError));
  assert.ok(
    shellHtml.includes('course-account-wrapper'),
    'Kontoknappen ska vara inkapslad i course-account-wrapper',
  );
  assert.ok(
    shellHtml.includes('course-account-error-badge'),
    'Felmeddelandet ska renderas i course-account-error-badge vid kontoknappen',
  );
  assert.ok(shellHtml.includes('Inloggning avbröts'), 'Felmeddelandet ska innehålla feltexten');
  assert.ok(
    shellHtml.includes('role="alert"'),
    'Felmeddelandet ska ha role="alert" för tillgänglighet',
  );

  // När inget fel finns visas ingen badge
  const hostWithoutError = createMockHost({
    authError: null,
  });
  const shellCleanHtml = renderTemplateToString(renderCourseShell(hostWithoutError));
  assert.ok(
    !shellCleanHtml.includes('course-account-error-badge'),
    'Ingen error badge ska renderas när authError är null',
  );
});

test('Ticket 05: Web Speech API returnerar no-voice vid saknad japansk röst och ger användarfeedback', () => {
  // Mock Speech API i global scope
  const originalWindow = globalThis.window;
  const originalSpeechSynthesis = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  try {
    let speakCalled = false;
    let cancelCalled = false;
    let noVoiceCallbackCalled = false;

    // Skapa en mockad röstlista med enbart engelska/svenska röster
    const mockVoices = [
      { lang: 'en-US', name: 'Samantha', default: true, localService: true, voiceURI: 'samantha' },
      { lang: 'sv-SE', name: 'Alva', default: false, localService: true, voiceURI: 'alva' },
    ];

    const mockSynth = {
      getVoices: () => mockVoices,
      speak: () => {
        speakCalled = true;
      },
      cancel: () => {
        cancelCalled = true;
      },
      addEventListener: () => {},
    };

    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    // @ts-expect-error Mocking for test
    globalThis.window = {
      speechSynthesis: mockSynth,
      SpeechSynthesisUtterance: MockUtterance,
    };
    // @ts-expect-error Mocking for test
    globalThis.speechSynthesis = mockSynth;
    // @ts-expect-error Mocking for test
    globalThis.SpeechSynthesisUtterance = MockUtterance;

    resetVoiceForTesting();

    const result = speak('こんにちは', {
      onNoVoice: () => {
        noVoiceCallbackCalled = true;
      },
    });

    assert.equal(
      result,
      'no-voice',
      'speak ska returnera no-voice när enheten saknar japansk röst',
    );
    assert.ok(noVoiceCallbackCalled, 'onNoVoice-callbacken ska anropas vid no-voice');
    assert.ok(cancelCalled, 'speechSynthesis.cancel ska anropas');
    assert.ok(speakCalled, 'speechSynthesis.speak ska anropas med ja-JP utterance');

    // Verifiera att CourseShell renderar speech-toast när speechNotice är satt
    const hostWithSpeechNotice = createMockHost({
      speechNotice: 'Din enhet saknar japansk talsyntesröst',
    });
    const shellWithToast = renderTemplateToString(renderCourseShell(hostWithSpeechNotice));
    assert.ok(
      shellWithToast.includes('course-speech-toast'),
      'course-speech-toast ska renderas när speechNotice är satt',
    );
    assert.ok(
      shellWithToast.includes('Din enhet saknar japansk talsyntesröst'),
      'Toasten ska innehålla förklarande text om saknad japansk röst',
    );
    assert.ok(shellWithToast.includes('role="status"'), 'Toasten ska ha role="status"');
  } finally {
    globalThis.window = originalWindow;
    globalThis.speechSynthesis = originalSpeechSynthesis;
    globalThis.SpeechSynthesisUtterance = originalUtterance;
    resetVoiceForTesting();
  }
});
