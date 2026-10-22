import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSushiShell } from '../src/course/sushi-game/sushi-view.ts';
import { isSushiEntryAvailable } from '../src/course/sushi-game/config.ts';
import {
  courseProgress,
  loadSushiGameModule,
  renderCourseShell,
  selectCourseSubView,
  resetSushiGameModuleForTesting,
} from '../src/course/course-view.ts';
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

function createMockHost(overrides: Partial<CourseHostContext> = {}): CourseHostContext & {
  loginCalls: number;
  accountCalls: number;
  renderCalls: number;
} {
  let status = 'Lokalt sparad';
  let authError: string | null = null;
  let speechNotice: string | null = null;

  const mock = {
    theme: 'classic' as const,
    toggleTheme: () => {},
    user: null as CourseHostContext['user'],
    authBusy: false,
    loginCalls: 0,
    accountCalls: 0,
    renderCalls: 0,
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
    account: () => {
      mock.accountCalls++;
    },
    onLogin: () => {
      mock.loginCalls++;
    },
    speak: (_text: string) => 'ok' as const,
    tts: true,
    get status() {
      return status;
    },
    render: () => {
      mock.renderCalls++;
    },
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

test('Ticket 02: isSushiEntryAvailable kontrollerar dev/test/preview vs produktionsspärr', () => {
  // 1. I standard testkörning returnerar den true
  assert.equal(isSushiEntryAvailable(), true, 'I testläge ska ingången vara tillgänglig');

  // 2. Explicit fönster-override med false stänger av ingången
  const mockWinDisabled = {
    __SUSHI_ENTRY_ENABLED: false,
    location: { search: '' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(
    isSushiEntryAvailable(mockWinDisabled),
    false,
    'Explicit false i fönsterobjektet ska dölja ingången',
  );

  // 3. Explicit fönster-override med true aktiverar ingången
  const mockWinEnabled = {
    __SUSHI_ENTRY_ENABLED: true,
    location: { search: '' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(
    isSushiEntryAvailable(mockWinEnabled),
    true,
    'Explicit true i fönsterobjektet ska visa ingången',
  );

  // 4. URL query parameter ?sushi=1 aktiverar preview
  const mockWinQuery = {
    location: { search: '?sushi=1' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(
    isSushiEntryAvailable(mockWinQuery),
    true,
    'URL-parametern ?sushi=1 ska aktivera ingången',
  );

  // 5. SessionStorage-flagga aktiverar preview
  const mockWinStorage = {
    location: { search: '' },
    sessionStorage: {
      getItem: (key: string) => (key === 'japc11-sushi-entry' ? 'true' : null),
    },
  } as unknown as Window;
  assert.equal(
    isSushiEntryAvailable(mockWinStorage),
    true,
    'SessionStorage japc11-sushi-entry=true ska aktivera ingången',
  );
});

test('Ticket 02: Åtkomstspärr (Auth Gate) visas för oinloggade användare och anonyma sessioner', () => {
  let backClicked = false;
  const guestHost = createMockHost({
    user: null,
  });

  const guestHtml = renderTemplateToString(
    renderSushiShell(guestHost, () => {
      backClicked = true;
    }),
  );

  assert.ok(guestHtml.includes('sushi-auth-gate'), 'Spärrsidan ska renderas för oinloggade gäster');
  assert.ok(
    guestHtml.includes('Logga in för att öppna restaurangen'),
    'Rubriken ska förklara inloggningskravet',
  );
  assert.ok(
    guestHtml.includes('sushi-login-btn'),
    'Logga in-knapp med data-testid="sushi-login-btn" ska finnas',
  );
  assert.ok(
    guestHtml.includes('sushi-back-btn'),
    'Tillbaka-knapp med data-testid="sushi-back-btn" ska finnas',
  );
  assert.ok(
    guestHtml.includes('Gäståtkomst eller demo stöds inte'),
    'Gästbegränsningen ska framgå tydligt',
  );
  assert.ok(
    !guestHtml.includes('sushi-stage'),
    'Ingen spelbar restaurang eller scen ska visas för gäster',
  );
  assert.ok(!guestHtml.includes('sushi-container'), 'Ingen spelcontainer ska renderas');

  // Även en eventuell anonym Firebase-användare spärras
  const anonHost = createMockHost({
    user: {
      uid: 'anon-123',
      // @ts-expect-error test flag
      isAnonymous: true,
    },
  });
  const anonHtml = renderTemplateToString(renderSushiShell(anonHost, () => {}));
  assert.ok(
    anonHtml.includes('sushi-auth-gate'),
    'Anonym session ska inte få tillgång till spelbar restaurang',
  );
  assert.ok(!anonHtml.includes('sushi-stage'), 'Anonym session får ingen scen');
});

test('Ticket 02: Inloggad student ser sushiskalet med identitet och renodlat gränssnitt', () => {
  let backClicked = false;
  const studentHost = createMockHost({
    user: {
      uid: 'student-tanaka',
      displayName: 'Tanaka Ken',
      email: 'tanaka@example.com',
    },
  });

  const studentHtml = renderTemplateToString(
    renderSushiShell(studentHost, () => {
      backClicked = true;
    }),
  );

  assert.ok(!studentHtml.includes('sushi-auth-gate'), 'Spärrsidan ska inte renderas för inloggad');
  assert.ok(studentHtml.includes('sushi-shell'), 'Sushiskalet ska renderas');
  assert.ok(
    studentHtml.includes('data-authenticated="true"'),
    'Skalet ska markeras som autentiserat',
  );
  assert.ok(studentHtml.includes('Tanaka Ken'), 'Studentens visningsnamn ska renderas');
  assert.ok(studentHtml.includes('sushi-stage'), 'Spelytan ska renderas för inloggad');
  assert.ok(
    studentHtml.includes('sushi-back-to-studies'),
    'Navigeringsknapp tillbaka till studierna ska finnas i toppmenyn',
  );
  assert.ok(studentHtml.includes('Logga ut'), 'Möjlighet att logga ut ska finnas via kontoknappen');
});

test('Ticket 02: Kontobyte och utloggning isolerar användaridentitet utan kvardröjande data', () => {
  // 1. Användare A
  const hostUserA = createMockHost({
    user: { uid: 'user-a', displayName: 'Sakura Haruno', email: 'sakura@example.com' },
  });
  const htmlA = renderTemplateToString(renderSushiShell(hostUserA, () => {}));
  assert.ok(htmlA.includes('Sakura Haruno'), 'Användare A ska visas');
  assert.ok(!htmlA.includes('Naruto Uzumaki'), 'Användare B ska inte synas');

  // 2. Kontobyte till Användare B
  const hostUserB = createMockHost({
    user: { uid: 'user-b', displayName: 'Naruto Uzumaki', email: 'naruto@example.com' },
  });
  const htmlB = renderTemplateToString(renderSushiShell(hostUserB, () => {}));
  assert.ok(htmlB.includes('Naruto Uzumaki'), 'Användare B ska visas efter kontobyte');
  assert.ok(
    !htmlB.includes('Sakura Haruno'),
    'Användare A:s uppgifter ska inte finnas kvar efter kontobyte',
  );

  // 3. Utloggning
  const hostLoggedOut = createMockHost({ user: null });
  const htmlLoggedOut = renderTemplateToString(renderSushiShell(hostLoggedOut, () => {}));
  assert.ok(
    htmlLoggedOut.includes('sushi-auth-gate'),
    'Vid utloggning ska Auth Gate visas omedelbart',
  );
  assert.ok(!htmlLoggedOut.includes('Naruto Uzumaki'), 'Ingen användardata kvar efter utloggning');
  assert.ok(!htmlLoggedOut.includes('Sakura Haruno'), 'Ingen tidigare användardata kvar');
});

test('Ticket 02: Felhantering och återförsök vid inloggningsfel', () => {
  const hostWithError = createMockHost({
    user: null,
    authError: 'Inloggning avbröts av användaren',
  });

  const htmlWithError = renderTemplateToString(renderSushiShell(hostWithError, () => {}));
  assert.ok(
    htmlWithError.includes('sushi-auth-error'),
    'Felmeddelande ska renderas när authError finns',
  );
  assert.ok(
    htmlWithError.includes('Inloggning avbröts av användaren'),
    'Feltexten ska renderas i alerten',
  );
  assert.ok(
    htmlWithError.includes('Försök igen'),
    'Knapp för återförsök ska finnas i felmeddelandet',
  );
});

test('Ticket 02: loadSushiGameModule laddar sushimodulen asynkront', async () => {
  resetSushiGameModuleForTesting();
  const mod = await loadSushiGameModule();
  assert.ok(mod, 'Modulen ska returneras');
  assert.equal(typeof mod.renderSushiShell, 'function', 'renderSushiShell ska vara en funktion');
});

test('Ticket 02: renderCourseShell isolerar sushivyn från studiernas sidomeny och studiemenyer', async () => {
  const host = createMockHost({
    user: { uid: 'student-1', displayName: 'Ken' },
  });

  // Säkerställ att modulen är inladdad
  await loadSushiGameModule(host);

  // 1. När vi är i hubben (studievyn)
  selectCourseSubView('hub', host);
  const hubHtml = renderTemplateToString(renderCourseShell(host));
  assert.ok(hubHtml.includes('course-sidebar'), 'Studiernas sidomeny ska finnas i studievyn');
  assert.ok(hubHtml.includes('course-top-nav'), 'Studiernas toppmeny ska finnas i studievyn');

  // 2. När vi växlar till sushivyn
  selectCourseSubView('sushi', host);
  assert.equal(courseProgress.snapshot().activeSubView, 'sushi');

  const sushiShellHtml = renderTemplateToString(renderCourseShell(host));
  assert.ok(
    sushiShellHtml.includes('sushi-shell'),
    'Sushiskalet ska renderas när subView === sushi',
  );
  assert.ok(
    !sushiShellHtml.includes('course-sidebar'),
    'Studiernas sidomeny får INTE renderas i sushivyn',
  );
  assert.ok(
    !sushiShellHtml.includes('course-top-nav'),
    'Studiernas studiemenyer får INTE renderas i sushivyn',
  );
  assert.ok(
    sushiShellHtml.includes('sushi-back-to-studies'),
    'Tydlig väg tillbaka till studierna ska finnas',
  );

  // 3. Återgå till hubben
  selectCourseSubView('hub', host);
  assert.equal(courseProgress.snapshot().activeSubView, 'hub');
  const restoredHubHtml = renderTemplateToString(renderCourseShell(host));
  assert.ok(
    restoredHubHtml.includes('course-sidebar'),
    'Sidomenyn ska återfinnas vid återgång till studierna',
  );
});
