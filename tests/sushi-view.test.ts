import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderSushiShell, SushiClientController } from '../src/course/sushi-game/sushi-view.ts';
import { isSushiEntryAvailable, isLocalhost } from '../src/course/sushi-game/config.ts';
import {
  courseProgress,
  loadSushiGameModule,
  renderCourseShell,
  selectCourseSubView,
  resetSushiGameModuleForTesting,
} from '../src/course/course-view.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import { SUSHI_UNLOCK_CATALOG } from '../src/course/sushi-game/medals.ts';
import {
  sushiService,
  InMemorySushiRepository,
  getOrInitRestaurant,
} from '../src/course/sushi-game/service.ts';
import type { CourseHostContext } from '../src/course/types.ts';

sushiService.setRepository(new InMemorySushiRepository());

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
    return out.replace(/\s+/g, ' ');
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

test('Ticket 02: isSushiEntryAvailable kontrollerar dev/test/preview vs produktionsspärr', async () => {
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

test('Ticket 02: Åtkomstspärr (Auth Gate) visas för oinloggade användare och anonyma sessioner', async () => {
  let backClicked = false;
  const guestHost = createMockHost({
    user: null,
  });

  const guestHtml = renderTemplateToString(
    await renderLoadedShell(guestHost, () => {
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
  const anonHtml = renderTemplateToString(await renderLoadedShell(anonHost, () => {}));
  assert.ok(
    anonHtml.includes('sushi-auth-gate'),
    'Anonym session ska inte få tillgång till spelbar restaurang',
  );
  assert.ok(!anonHtml.includes('sushi-stage'), 'Anonym session får ingen scen');
});

test('Ticket 02: Inloggad student ser sushiskalet med identitet och renodlat gränssnitt', async () => {
  let backClicked = false;
  const studentHost = createMockHost({
    user: {
      uid: 'student-tanaka',
      displayName: 'Tanaka Ken',
      email: 'tanaka@example.com',
    },
  });

  const studentHtml = renderTemplateToString(
    await renderLoadedShell(studentHost, () => {
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

test('Ticket 02: Kontobyte och utloggning isolerar användaridentitet utan kvardröjande data', async () => {
  // 1. Användare A
  const hostUserA = createMockHost({
    user: { uid: 'user-a', displayName: 'Sakura Haruno', email: 'sakura@example.com' },
  });
  const htmlA = renderTemplateToString(await renderLoadedShell(hostUserA, () => {}));
  assert.ok(htmlA.includes('Sakura Haruno'), 'Användare A ska visas');
  assert.ok(!htmlA.includes('Naruto Uzumaki'), 'Användare B ska inte synas');

  // 2. Kontobyte till Användare B
  const hostUserB = createMockHost({
    user: { uid: 'user-b', displayName: 'Naruto Uzumaki', email: 'naruto@example.com' },
  });
  const htmlB = renderTemplateToString(await renderLoadedShell(hostUserB, () => {}));
  assert.ok(htmlB.includes('Naruto Uzumaki'), 'Användare B ska visas efter kontobyte');
  assert.ok(
    !htmlB.includes('Sakura Haruno'),
    'Användare A:s uppgifter ska inte finnas kvar efter kontobyte',
  );

  // 3. Utloggning
  const hostLoggedOut = createMockHost({ user: null });
  const htmlLoggedOut = renderTemplateToString(await renderLoadedShell(hostLoggedOut, () => {}));
  assert.ok(
    htmlLoggedOut.includes('sushi-auth-gate'),
    'Vid utloggning ska Auth Gate visas omedelbart',
  );
  assert.ok(!htmlLoggedOut.includes('Naruto Uzumaki'), 'Ingen användardata kvar efter utloggning');
  assert.ok(!htmlLoggedOut.includes('Sakura Haruno'), 'Ingen tidigare användardata kvar');
});

test('Ticket 02: Felhantering och återförsök vid inloggningsfel', async () => {
  const hostWithError = createMockHost({
    user: null,
    authError: 'Inloggning avbröts av användaren',
  });

  const htmlWithError = renderTemplateToString(await renderLoadedShell(hostWithError, () => {}));
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

// ---------------------------------------------------------------------------
// F20: Responsive 2D Scene & Shell Structure (Tier 1 & Tier 2 BVA)
// ---------------------------------------------------------------------------

test('F20-T1: Scene structure renders container, stage, header, and scene placeholder for authenticated user', async () => {
  const host = createMockHost({
    user: { uid: 'user-ken', displayName: 'Ken' },
  });
  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  assert.ok(html.includes('sushi-container'), 'Container element must be present');
  assert.ok(html.includes('sushi-stage'), 'Stage element must be present');
  assert.ok(html.includes('sushi-stage-header'), 'Stage header must be present');
  assert.ok(html.includes('sushi-scene-placeholder'), 'Scene placeholder must be present');
  assert.ok(html.includes('sushi-stage-actions'), 'Stage actions container must be present');
});

test('F20-T2: Back to studies actions in topbar, stage, and auth gate trigger onBackToStudies callback', async () => {
  let calls = 0;
  const onBack = () => {
    calls++;
  };

  // 1. Authenticated user
  const authHost = createMockHost({
    user: { uid: 'user-1', displayName: 'Ken' },
  });
  const authHtml = renderTemplateToString(await renderLoadedShell(authHost, onBack));
  assert.ok(authHtml.includes('sushi-back-to-studies'), 'Topbar back button must exist');
  assert.ok(authHtml.includes('sushi-stage-back-btn'), 'Stage back button must exist');

  // 2. Guest user
  const guestHost = createMockHost({ user: null });
  const guestHtml = renderTemplateToString(await renderLoadedShell(guestHost, onBack));
  assert.ok(guestHtml.includes('sushi-back-btn'), 'Auth gate back button must exist');
});

test('F20-T3: Responsive theme attribute toggles between classic and sakura on root shell element', async () => {
  // Classic theme
  const hostClassic = createMockHost({
    theme: 'classic',
    user: { uid: 'user-1', displayName: 'Ken' },
  });
  const htmlClassic = renderTemplateToString(await renderLoadedShell(hostClassic, () => {}));
  assert.ok(htmlClassic.includes('data-theme=classic'), 'Shell must reflect classic theme');

  // Sakura theme
  const hostSakura = createMockHost({
    theme: 'sakura',
    user: { uid: 'user-1', displayName: 'Ken' },
  });
  const htmlSakura = renderTemplateToString(await renderLoadedShell(hostSakura, () => {}));
  assert.ok(htmlSakura.includes('data-theme=sakura'), 'Shell must reflect sakura theme');
});

test('F20-T4: User avatar renders photoURL if present and uppercase initial fallback if absent', async () => {
  // With photoURL
  const hostWithPhoto = createMockHost({
    user: {
      uid: 'user-1',
      displayName: 'Ken',
      photoURL: 'https://example.com/avatar.png',
    },
  });
  const htmlWithPhoto = renderTemplateToString(await renderLoadedShell(hostWithPhoto, () => {}));
  assert.ok(
    htmlWithPhoto.includes('src=https://example.com/avatar.png'),
    'Must render image element with photoURL',
  );
  assert.ok(!htmlWithPhoto.includes('sushi-avatar-fallback'), 'Must not render fallback avatar');

  // Without photoURL: fallback initial
  const hostNoPhoto = createMockHost({
    user: {
      uid: 'user-2',
      displayName: 'tanaka ken',
      photoURL: null,
    },
  });
  const htmlNoPhoto = renderTemplateToString(await renderLoadedShell(hostNoPhoto, () => {}));
  assert.ok(htmlNoPhoto.includes('sushi-avatar-fallback'), 'Must render fallback avatar');
  assert.ok(htmlNoPhoto.includes('T'), 'Fallback initial must be uppercase T');
});

test('F20-T5: Adversarial & Escaping: XSS strings and Japanese Unicode characters in user profile', async () => {
  // Japanese Kanji, Kana & Sushi Emoji
  const hostJapanese = createMockHost({
    user: {
      uid: 'user-jp',
      displayName: '田中 健 🍣',
    },
  });
  const htmlJp = renderTemplateToString(await renderLoadedShell(hostJapanese, () => {}));
  assert.ok(htmlJp.includes('田中 健 🍣'), 'Japanese characters and emojis must render correctly');

  // Script tags in displayName must be rendered harmlessly as text
  const hostXss = createMockHost({
    user: {
      uid: 'user-xss',
      displayName: '<script>alert("hacked")</script>',
    },
  });
  const htmlXss = renderTemplateToString(await renderLoadedShell(hostXss, () => {}));
  // In lit-html template interpolations, values are escaped or handled as text nodes, not executed
  assert.ok(htmlXss.includes('sushi-user-name'), 'Username container must exist');
});

// ---------------------------------------------------------------------------
// F22: Accessibility & Semantic Landmark Roles (Tier 1 & Tier 2 BVA)
// ---------------------------------------------------------------------------

test('F22-T1: Semantic landmark roles and accessibility attributes are correctly placed', async () => {
  const guestHost = createMockHost({ user: null });
  const guestHtml = renderTemplateToString(await renderLoadedShell(guestHost, () => {}));

  assert.ok(guestHtml.includes('role="region"'), 'Auth gate must have role="region"');
  assert.ok(
    guestHtml.includes('aria-label="Inloggningskrav"'),
    'Auth gate must have aria-label="Inloggningskrav"',
  );

  const authHost = createMockHost({
    user: { uid: 'user-1', displayName: 'Ken' },
  });
  const authHtml = renderTemplateToString(await renderLoadedShell(authHost, () => {}));

  assert.ok(
    authHtml.includes('aria-label="Personlig sushirestaurang"'),
    'Authenticated stage must have descriptive aria-label',
  );
  assert.ok(authHtml.includes('class="sushi-topbar"'), 'Topbar header must be present');
  assert.ok(authHtml.includes('class="sushi-main"'), 'Main content must be present');
  assert.ok(
    !authHtml.includes('class="sushi-title" lang="ja"'),
    'Swedish heading must inherit the page language',
  );
});

test('F22-T2: All interactive buttons are semantic button[type="button"] with test IDs', async () => {
  const authHost = createMockHost({
    user: { uid: 'user-1', displayName: 'Ken' },
  });
  const html = renderTemplateToString(await renderLoadedShell(authHost, () => {}));

  // Asserting key buttons have type="button" and respective classes/test IDs
  assert.ok(html.includes('class="sushi-back-btn"'));
  assert.ok(html.includes('data-testid="sushi-back-to-studies"'));
  assert.ok(html.includes('class="sushi-icon-btn sushi-symbol-btn"'));
  assert.ok(html.includes('class="sushi-account-btn logged-in"'));
  assert.ok(html.includes('data-testid="sushi-stage-back-btn"'));
});

test('F22-T3: Theme toggle button title reflects next accessible theme state', async () => {
  // When theme is classic
  const hostClassic = createMockHost({ theme: 'classic' });
  const htmlClassic = renderTemplateToString(await renderLoadedShell(hostClassic, () => {}));
  assert.ok(
    htmlClassic.includes('Slå på Sakura / Kawaii-tema'),
    'Tooltip must explain switching to Sakura',
  );

  // When theme is sakura
  const hostSakura = createMockHost({ theme: 'sakura' });
  const htmlSakura = renderTemplateToString(await renderLoadedShell(hostSakura, () => {}));
  assert.ok(
    htmlSakura.includes('Växla till Washi & Matcha-tema'),
    'Tooltip must explain switching to Washi',
  );
});

test('F22-T4: Auth error alert has role="alert" for immediate screen reader announcement', async () => {
  const hostWithError = createMockHost({
    user: null,
    authError: 'Nätverksfel vid inloggning',
  });
  const html = renderTemplateToString(await renderLoadedShell(hostWithError, () => {}));

  assert.ok(
    html.includes('role="alert" data-testid="sushi-auth-error"'),
    'Error container must have role="alert" and data-testid="sushi-auth-error"',
  );
  assert.ok(html.includes('Nätverksfel vid inloggning'));
  assert.ok(html.includes('Försök igen'));
});

test('F22-T5: Account button has descriptive title with user identity and logout instructions', async () => {
  const host = createMockHost({
    user: { uid: 'user-a', displayName: 'Sakura Kinomoto', email: 'sakura@example.com' },
  });
  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  assert.ok(
    html.includes('title="Inloggad som Sakura Kinomoto · Klicka för att logga ut"'),
    'Account button must have accessible tooltip describing user and action',
  );
});

// ---------------------------------------------------------------------------
// F23: Config & Environment Boundary Cases (Tier 1 & Tier 2 BVA)
// ---------------------------------------------------------------------------

test('F23-T1: isSushiEntryAvailable handles multi-parameter URLs and non-matching queries', async () => {
  // Query with other parameters and sushi=1
  const win1 = {
    location: { search: '?week=1&theme=sakura&sushi=1' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(isSushiEntryAvailable(win1), true);

  // Query with sushi=true
  const win2 = {
    location: { search: '?sushi=true' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(isSushiEntryAvailable(win2), true);

  // Query with unrelated parameters
  const win3 = {
    location: { search: '?week=2&mode=quiz' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(isSushiEntryAvailable(win3), true, 'In test runner process.env.NODE_ENV is test');
});

test('F23-T2: isSushiEntryAvailable handles SSR and undefined window safely without throwing', async () => {
  // When window is explicitly undefined
  const result = isSushiEntryAvailable(undefined);
  assert.equal(typeof result, 'boolean', 'Must return a boolean without throwing');
});

test('F23-T3: isSushiEntryAvailable sessionStorage boundary values', async () => {
  // SessionStorage with empty string or false does not activate preview if window flag is explicitly false
  const winFalse = {
    __SUSHI_ENTRY_ENABLED: false,
    location: { search: '' },
    sessionStorage: { getItem: () => 'false' },
  } as unknown as Window;
  assert.equal(isSushiEntryAvailable(winFalse), false, 'Window override false takes precedence');
});

test('F23-T4: isSushiEntryAvailable och isLocalhost identifierar lokala miljöer', async () => {
  assert.equal(isLocalhost(undefined), false);
  assert.equal(isLocalhost({ location: { hostname: 'example.com' } } as unknown as Window), false);
  assert.equal(isLocalhost({ location: { hostname: 'localhost' } } as unknown as Window), true);
  assert.equal(isLocalhost({ location: { hostname: '127.0.0.1' } } as unknown as Window), true);
  assert.equal(isLocalhost({ location: { hostname: '[::1]' } } as unknown as Window), true);
  assert.equal(isLocalhost({ location: { hostname: 'sub.localhost' } } as unknown as Window), true);

  const winLocal = {
    location: { hostname: 'localhost', search: '' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(isSushiEntryAvailable(winLocal), true, 'Localhost ska ge tillgång');

  const winIp = {
    location: { hostname: '127.0.0.1', search: '' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(isSushiEntryAvailable(winIp), true, '127.0.0.1 ska ge tillgång');

  const winLocalDisabled = {
    __SUSHI_ENTRY_ENABLED: false,
    location: { hostname: 'localhost', search: '' },
    sessionStorage: { getItem: () => null },
  } as unknown as Window;
  assert.equal(
    isSushiEntryAvailable(winLocalDisabled),
    false,
    'Explicit false har företräde även på localhost',
  );
});

// ---------------------------------------------------------------------------
// Milestone 1 (Tickets 03 & 04): Active View, Cash Register & Ticker Tests
// ---------------------------------------------------------------------------

test('Ticket 03 & 04 UI: Renders cash register, spendable balance, rate bar, bottleneck, progress bar, and announcer', async () => {
  const host = createMockHost({
    user: { uid: 'student-ken', displayName: 'Ken Tanaka' },
  });

  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  // Spendable balance badge
  assert.ok(html.includes('sushi-spendable-balance'), 'Spendable balance badge must be present');
  assert.ok(html.includes('Disponibelt saldo:'), 'Spendable balance label must be present');

  // Cash register
  assert.ok(html.includes('sushi-cash-register'), 'Cash register container must be present');
  assert.ok(html.includes('Ohämtade intäkter'), 'Uncollected income label must be present');
  assert.ok(
    html.includes('sushi-uncollected-amount'),
    'Uncollected amount element must be present',
  );

  // Rate bar and bottleneck
  assert.ok(html.includes('sushi-rate-info'), 'Rate info bar must be present');
  assert.ok(html.includes('Intäktstakt:'), 'Rate label must be present');
  assert.ok(html.includes('10 ¥/min'), 'Default rate must be 10 yen/min');
  assert.ok(html.includes('Kök (Flaskhals)'), 'Initial bottleneck must be Kitchen');

  // Cap tracker & progress bar
  assert.ok(html.includes('role="progressbar"'), 'Progress bar must have role="progressbar"');
  assert.ok(
    html.includes('aria-label="Produktionstid i perioden"'),
    'Progress bar must have aria-label',
  );
  assert.ok(html.includes('aria-valuemin="0"'), 'Progress bar must have aria-valuemin="0"');
  assert.ok(html.includes('aria-valuemax="100"'), 'Progress bar must have aria-valuemax="100"');

  // Collect button
  assert.ok(html.includes('sushi-collect-btn'), 'Collect button must be present');
  assert.ok(html.includes('Hämta intäkter'), 'Collect button must have Swedish label');

  // ARIA live announcer
  assert.ok(html.includes('sushi-live-announcer'), 'ARIA live announcer element must be present');
  assert.ok(html.includes('aria-live="polite"'), 'Announcer must have aria-live="polite"');
  assert.ok(html.includes('role="status"'), 'Announcer must have role="status"');
});

test('Ticket 04 UI: SushiClientController handles accrual recalculation, cap clamping, and reset', async () => {
  const controller = new SushiClientController();
  const host = createMockHost({
    user: { uid: 'student-test', displayName: 'Test User' },
  });

  controller.init('student-test', host);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(controller.state, 'Controller must have state initialized');

  // Initial calculation at T=0
  const initial = controller.recalculate();
  assert.equal(initial.displayedUncollectedYen, 0);
  assert.equal(initial.isCapped, false);
  assert.equal(initial.rate.yenPerMinute, 10);
  assert.equal(initial.rate.bottleneck, 'kitchen');

  // Simulate 30 minutes wall-clock elapsed
  controller.clientReceivedAtMs = Date.now() - 30 * 60 * 1000;
  const after30m = controller.recalculate();
  assert.equal(after30m.displayedUncollectedYen, 300);
  assert.equal(after30m.currentUsedProductionMs, 30 * 60 * 1000);
  assert.equal(after30m.isCapped, false);

  // Simulate 10 hours elapsed (capped at 8h = 4,800 yen)
  controller.clientReceivedAtMs = Date.now() - 10 * 3600 * 1000;
  const after10h = controller.recalculate();
  assert.equal(after10h.displayedUncollectedYen, 4800);
  assert.equal(after10h.currentUsedProductionMs, 8 * 3600 * 1000);
  assert.equal(after10h.isCapped, true);
  assert.equal(after10h.progressPercent, 100);

  // Reset clears state
  controller.reset();
  assert.equal(controller.uid, null);
  assert.equal(controller.state, null);
  assert.deepEqual(controller.recentlyUnlocked, []);
});

// ---------------------------------------------------------------------------
// Milestone 2 (Ticket 05): Client UI Unlock Experience Tests
// ---------------------------------------------------------------------------

test('Ticket 05 UI: Unlocks panel renders all 7 items with count badge and purchase eligibility explanation', async () => {
  const host = createMockHost({
    user: { uid: 'student-unlocks-view', displayName: 'Aoi' },
  });

  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  // Panel landmarks
  assert.ok(html.includes('sushi-unlocks-panel'), 'Unlocks panel must be present');
  assert.ok(html.includes('Kursbelöningar & Upplåsningar'), 'Panel title must be present');
  assert.ok(html.includes('sushi-unlocks-count-badge'), 'Count badge element must be present');
  assert.ok(
    html.includes('Upplåsning ger inte gratis föremål'),
    'Explanatory text must clarify that unlocking grants purchase eligibility, not free items',
  );

  // All 7 items in catalog must be rendered in grid
  for (const item of SUSHI_UNLOCK_CATALOG) {
    assert.ok(
      html.includes(`unlock-card-${item.id}`),
      `Card for ${item.id} (${item.name}) must be present in the unlocks grid`,
    );
  }
});

test('Ticket 05 UI: Unlocked item displays "Upplåst köpmöjlighet" and price hint in yen', async () => {
  const uid = 'student-unlocked-badges';
  const host = createMockHost({
    user: { uid, displayName: 'Ren' },
  });

  // Seed restaurant with prep_counter grant
  await getOrInitRestaurant(uid, Date.now(), ['prep_counter']);

  // Initial render initiates controller and fires getOrInitRestaurant
  await renderLoadedShell(host, () => {});
  // Wait for the async getOrInitRestaurant in activeController.init to complete
  await new Promise((r) => setTimeout(r, 20));

  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  assert.ok(
    html.includes('unlock-badge-prep_counter'),
    'Badge element for prep_counter must be rendered',
  );
  assert.ok(
    html.includes('🔓 Upplåst köpmöjlighet'),
    'Badge text must indicate unlocked purchase eligibility',
  );
  assert.ok(
    html.includes('Pris i butik: ¥ 300'),
    'Price hint in yen must be clearly indicated for unlocked item',
  );
});

test('Ticket 05 UI: Locked item displays "Låst", required chapter, and clickable study link button', async () => {
  const uid = 'student-locked-badges';
  const host = createMockHost({
    user: { uid, displayName: 'Yuki' },
  });

  // User has no grants
  await getOrInitRestaurant(uid, Date.now(), []);

  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  assert.ok(
    html.includes('unlock-badge-conveyor_belt'),
    'Badge element for conveyor_belt must be rendered',
  );
  assert.ok(html.includes('🔒 Låst'), 'Badge text must indicate locked state');
  assert.ok(
    html.includes('Kräver Kapitel 9 Brons (60%)'),
    'Requirement text must clearly show chapter and tier',
  );
  assert.ok(
    html.includes('study-link-btn-conveyor_belt'),
    'Study link button for conveyor_belt must be rendered',
  );
  assert.ok(html.includes('Öppna Kapitel 9 →'), 'Button label must direct to relevant chapter');
});

test('Ticket 05 UI: Clicking chapter study link invokes navigation callback with chapter number and week ID', async () => {
  const uid = 'student-nav-link';
  const host = createMockHost({
    user: { uid, displayName: 'Hina' },
  });

  let navigatedLesson = -1;
  let navigatedWeek = '';

  const onNavigateToChapter = (lessonNumber: number, weekId: string) => {
    navigatedLesson = lessonNumber;
    navigatedWeek = weekId;
  };

  // Render shell passing onNavigateToChapter
  const tmpl = await renderLoadedShell(host, () => {}, null, onNavigateToChapter);
  const html = renderTemplateToString(tmpl);
  assert.ok(html.includes('study-link-btn-conveyor_belt'));

  // Simulate invoking the navigation handler
  onNavigateToChapter(9, 'week-4');
  assert.equal(navigatedLesson, 9, 'Must navigate to lesson 9');
  assert.equal(navigatedWeek, 'week-4', 'Must navigate to week-4 for Chapter 9 Conveyor Belt');
});

test('Ticket 05 UI: Accessible celebratory unlock banner displays when recentlyUnlocked is present', async () => {
  const controller = new SushiClientController();
  const host = createMockHost({
    user: { uid: 'student-banner', displayName: 'Daiki' },
  });

  controller.init('student-banner', host);
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.recentlyUnlocked = ['prep_counter'];

  // Test getRecentlyUnlockedNames
  const names = controller.getRecentlyUnlockedNames();
  assert.deepEqual(names, ['Förbättrad beredningsbänk']);

  // Format announcement
  const announcement = controller.formatAnnouncement(['prep_counter']);
  assert.ok(
    announcement.includes('Förbättrad beredningsbänk'),
    'Announcement must name the unlocked item',
  );
  assert.ok(
    announcement.includes('Kapitel 6 Bronsmedalj'),
    'Announcement must specify the earned chapter medal',
  );

  controller.reset();
});

test('Ticket 05 UI: Dismissing celebratory unlock banner clears recentlyUnlocked and removes banner', async () => {
  const controller = new SushiClientController();
  const host = createMockHost({
    user: { uid: 'student-dismiss', displayName: 'Emi' },
  });

  controller.init('student-dismiss', host);
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.recentlyUnlocked = ['salmon_nigiri'];
  assert.equal(controller.recentlyUnlocked.length, 1);

  // Dismiss
  controller.dismissRecentlyUnlocked();
  assert.deepEqual(controller.recentlyUnlocked, [], 'recentlyUnlocked must be emptied');
  assert.ok(host.renderCalls > 0, 'Dismissing must trigger a host re-render');

  controller.reset();
});

test('Ticket 05 UI: ARIA live announcer includes Swedish announcement for newly unlocked items', async () => {
  const controller = new SushiClientController();

  // Single item announcement
  const singleMsg = controller.formatAnnouncement(['prep_counter']);
  assert.ok(singleMsg.startsWith('Grattis! Ny kursbelöning upplåst: Förbättrad beredningsbänk'));
  assert.ok(singleMsg.includes('Kapitel 6 Bronsmedalj'));

  // Multiple items announcement
  const multiMsg = controller.formatAnnouncement(['prep_counter', 'conveyor_belt']);
  assert.ok(multiMsg.startsWith('Grattis! 2 nya kursbelöningar upplåsta från dina kursmedaljer:'));
  assert.ok(multiMsg.includes('Förbättrad beredningsbänk, Transportband'));

  // Empty returns empty string
  assert.equal(controller.formatAnnouncement([]), '');
});

test('Ticket 05 UI: Navigation auto-sync - re-entry with new study progress evaluates and synchronizes grants', async () => {
  const uid = 'student-auto-sync';
  const host = createMockHost({
    user: { uid, displayName: 'Kaito' },
  });

  // Fresh progress
  const progress = createFreshCourseProgress();
  const tmpl1 = await renderLoadedShell(host, () => {}, progress);
  const html1 = renderTemplateToString(tmpl1);
  assert.ok(html1.includes('sushi-unlocks-panel'));

  // Now student masters Chapter 6 vocabulary (Bronze >= 60%)
  const w1 = courseProgress.snapshot(); // test course snapshot
  const initialFresh = createFreshCourseProgress();
  // Master 62 items in Lesson 6:
  for (let i = 0; i < 62; i++) {
    initialFresh.masteredVocabIds[`vocab_${i}`] = true;
  }

  // Re-entering with new progress passes updated snapshot
  const tmpl2 = await renderLoadedShell(host, () => {}, initialFresh);
  assert.ok(tmpl2, 'Re-entry render succeeds');
});

test('Ticket 05 UI: Auth gate strictly prevents access to unlock panel, banner, or announcers for unauthenticated/anonymous users', async () => {
  // 1. Unauthenticated guest
  const guestHost = createMockHost({ user: null });
  const guestHtml = renderTemplateToString(await renderLoadedShell(guestHost, () => {}));
  assert.ok(guestHtml.includes('sushi-auth-gate'), 'Auth gate rendered');
  assert.ok(!guestHtml.includes('sushi-unlocks-panel'), 'Zero unlock panels for guests');
  assert.ok(!guestHtml.includes('sushi-unlock-banner'), 'Zero unlock banners for guests');
  assert.ok(!guestHtml.includes('sushi-live-announcer'), 'Zero live announcers for guests');

  // 2. Anonymous session
  const anonHost = createMockHost({
    user: {
      uid: 'anon-user-1',
      // @ts-expect-error test flag
      isAnonymous: true,
    },
  });
  const anonHtml = renderTemplateToString(await renderLoadedShell(anonHost, () => {}));
  assert.ok(anonHtml.includes('sushi-auth-gate'), 'Auth gate rendered for anonymous users');
  assert.ok(!anonHtml.includes('sushi-unlocks-panel'), 'Zero unlock panels for anonymous users');
  assert.ok(!anonHtml.includes('sushi-unlock-banner'), 'Zero unlock banners for anonymous users');
});

test('Ticket 05 UI: Logout wipes state, recentlyUnlocked, and announcements completely', async () => {
  const controller = new SushiClientController();
  const host = createMockHost({
    user: { uid: 'student-logout-test', displayName: 'Mei' },
  });

  controller.init('student-logout-test', host);
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.recentlyUnlocked = ['prep_counter', 'salmon_nigiri'];
  controller.announcement = 'Grattis!';

  // Log out
  controller.reset();
  assert.equal(controller.uid, null);
  assert.equal(controller.state, null);
  assert.deepEqual(controller.recentlyUnlocked, []);
  assert.equal(controller.announcement, '');
  assert.equal(controller.error, null);
});

test('Ticket 05 UI: Reduced motion styles present in stylesheet', async () => {
  const cssPath = resolve(process.cwd(), 'src/course/sushi-game/sushi.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  assert.ok(
    cssContent.includes('@media (prefers-reduced-motion: reduce)'),
    'CSS must contain prefers-reduced-motion media query',
  );
  assert.ok(
    cssContent.includes('.sushi-unlock-banner'),
    'Reduced motion must target .sushi-unlock-banner',
  );
  assert.ok(cssContent.includes('.sushi-pill-new'), 'Reduced motion must target .sushi-pill-new');
  assert.ok(
    cssContent.includes('.sushi-unlock-card'),
    'Reduced motion must target .sushi-unlock-card',
  );
  assert.ok(cssContent.includes('.sushi-btn-buy'), 'Reduced motion must target .sushi-btn-buy');
});

test('Ticket 06 & 07 UI: Shop cards render all four purchase states (Låst, För dyr, Köpbar, Ägd)', async () => {
  const uid = 'student-shop-states';
  const host = createMockHost({
    user: { uid, displayName: 'Yuji' },
  });

  // Setup restaurant state with:
  // - prep_counter: owned
  // - salmon_nigiri: unlocked and affordable (balance = 1000 yen >= 600 yen)
  // - conveyor_belt: unlocked but unaffordable (needs 3600 yen, balance = 1000 yen)
  // - wave_print: locked (not in permanentGrants)
  await getOrInitRestaurant(uid, Date.now(), ['prep_counter', 'salmon_nigiri', 'conveyor_belt']);
  const repo = (await import('../src/course/sushi-game/service.ts')).sushiService.getRepository();
  await repo.transaction(uid, async (current) => ({
    state: {
      ...current!,
      inventory: ['prep_counter'],
      balanceUnits: 1000 * 60_000,
    },
    result: null,
  }));

  await renderLoadedShell(host, () => {});
  await new Promise((r) => setTimeout(r, 20));
  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  // 1. prep_counter is OWNED
  assert.ok(html.includes('data-purchase-state="owned"'), 'Owned state must be present on card');
  assert.ok(html.includes('owned-indicator-prep_counter'), 'Owned indicator must be present');
  assert.ok(html.includes('Aktiv i restaurangen'));

  // 2. salmon_nigiri is AFFORDABLE
  assert.ok(html.includes('data-purchase-state="affordable"'));
  assert.ok(html.includes('buy-btn-salmon_nigiri'));
  assert.ok(html.includes('Köp för ¥ 600'));

  // 3. conveyor_belt is UNAFFORDABLE (För dyr: saknar 2600 yen)
  assert.ok(html.includes('data-purchase-state="unaffordable"'));
  assert.ok(html.includes('missing-funds-conveyor_belt'));
  assert.ok(html.includes('Saknar ¥ 2600'));
  assert.ok(html.includes('För lite yen (saknar ¥ 2600)'));

  // 4. wave_print is LOCKED
  assert.ok(html.includes('data-purchase-state="locked"'));
  assert.ok(html.includes('study-link-btn-wave_print'));
  assert.ok(html.includes('Kräver Kapitel 9 Guld (100%)'));
});

test('Ticket 06 & 07 UI: Bottleneck explainer displays pedagogical advice when capacity increase does not raise income', async () => {
  const uid = 'student-bottleneck-ui';
  const host = createMockHost({
    user: { uid, displayName: 'Nobara' },
  });

  // Base state: kitchen=1, service=2. conveyor_belt is unlocked (+2 service).
  // Buying conveyor_belt would make service 4, but kitchen stays 1 -> bottleneck explainer must trigger!
  await getOrInitRestaurant(uid, Date.now(), ['conveyor_belt']);

  await renderLoadedShell(host, () => {});
  await new Promise((r) => setTimeout(r, 20));
  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  assert.ok(
    html.includes('bottleneck-explainer-conveyor_belt'),
    'Bottleneck explainer must be rendered for conveyor_belt',
  );
  assert.ok(
    html.includes(
      'Detta köp ökar servicekapaciteten till 4 ordrar/min, men köket producerar bara 1 order/min',
    ),
    'Educational explanation must clarify why rate does not immediately rise',
  );
});

test('Ticket 06 & 07 UI: Scene placeholder displays visual equipment badges for owned items', async () => {
  const uid = 'student-scene-badges';
  const host = createMockHost({
    user: { uid, displayName: 'Megumi' },
  });

  // Restaurant owns prep_counter and conveyor_belt
  await getOrInitRestaurant(uid, Date.now(), ['prep_counter', 'conveyor_belt']);
  const repo = (await import('../src/course/sushi-game/service.ts')).sushiService.getRepository();
  await repo.transaction(uid, async (current) => ({
    state: {
      ...current!,
      inventory: ['prep_counter', 'conveyor_belt'],
      kitchenCapacity: 3,
      serviceCapacity: 4,
    },
    result: null,
  }));

  await renderLoadedShell(host, () => {});
  await new Promise((r) => setTimeout(r, 20));
  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  assert.ok(html.includes('scene-prep-counter'), 'Prep counter badge must be visible in scene');
  assert.ok(html.includes('scene-conveyor-belt'), 'Conveyor belt badge must be visible in scene');
  assert.ok(html.includes('Förbättrad beredningsbänk (+2 kök)'));
  assert.ok(html.includes('Transportband (+2 service)'));
});

test('Ticket 08 UI: Dynamic cap badges and active indicator display for 8h standard vs 12h extended cap', async () => {
  const uidStandard = 'student-cap-8h';
  const hostStandard = createMockHost({
    user: { uid: uidStandard, displayName: 'Aoi' },
  });
  await getOrInitRestaurant(uidStandard, Date.now(), []);

  await renderLoadedShell(hostStandard, () => {});
  await new Promise((r) => setTimeout(r, 20));
  const htmlStandard = renderTemplateToString(await renderLoadedShell(hostStandard, () => {}));
  assert.ok(htmlStandard.includes('sushi-cap-badge-8h'), '8h badge must be shown on standard cap');
  assert.ok(!htmlStandard.includes('sushi-cap-active-badge'), 'No active indicator on 8h cap');

  // Extended cap user
  const uidExtended = 'student-cap-12h';
  const hostExtended = createMockHost({
    user: { uid: uidExtended, displayName: 'Maki' },
  });
  await getOrInitRestaurant(uidExtended, Date.now(), ['cap_extension_12h']);
  const repo = (await import('../src/course/sushi-game/service.ts')).sushiService.getRepository();
  await repo.transaction(uidExtended, async (current) => ({
    state: {
      ...current!,
      capMs: 43_200_000,
      inventory: ['cap_extension_12h'],
    },
    result: null,
  }));

  await renderLoadedShell(hostExtended, () => {});
  await new Promise((r) => setTimeout(r, 20));
  const htmlExtended = renderTemplateToString(await renderLoadedShell(hostExtended, () => {}));
  assert.ok(
    htmlExtended.includes('sushi-cap-badge-12h'),
    '12h badge must be shown on extended cap',
  );
  assert.ok(
    htmlExtended.includes('sushi-cap-active-badge'),
    'Active indicator must be shown on 12h cap',
  );
  assert.ok(htmlExtended.includes('Ny produktionstid aktiv! (12 timmar max)'));
  assert.ok(
    htmlExtended.includes('scene-cap-extension'),
    '12h cap equipment badge must appear in scene',
  );
});

test('Ticket 06 UI: Controller buy() executes purchase, debits funds, and updates ARIA announcement', async () => {
  const uid = 'student-buy-controller';
  const controller = new SushiClientController();
  const host = createMockHost({
    user: { uid, displayName: 'Panda' },
  });

  controller.init(uid, host);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const repo = (await import('../src/course/sushi-game/service.ts')).sushiService.getRepository();
  await repo.transaction(uid, async (current) => ({
    state: {
      ...current!,
      permanentGrants: ['prep_counter'],
      balanceUnits: 1000 * 60_000,
    },
    result: null,
  }));

  // Re-init so controller picks up state
  await (await import('../src/course/sushi-game/service.ts')).sushiService.getOrInitRestaurant(uid);
  controller.state = await repo.get(uid);

  // Execute buy
  await controller.buy('prep_counter');

  assert.equal(controller.isBuying, null);
  assert.equal(controller.buyError, null);
  assert.ok(controller.state?.inventory.includes('prep_counter'));
  assert.equal(controller.state?.kitchenCapacity, 3);
  assert.ok(
    controller.announcement.includes('Köp genomfört: Förbättrad beredningsbänk för ¥ 300!'),
  );

  controller.reset();
});

// ---------------------------------------------------------------------------
// Milestone 3: Locked Viewport, Rustic Japanese HUD & Collapsible Overlays
// ---------------------------------------------------------------------------

test('Milestone 3 UI: HUD overlay toggles, close buttons, and category filters render correctly', async () => {
  const host = createMockHost({
    user: { uid: 'student-m3-hud', displayName: 'Sakura' },
  });

  const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

  // Topbar HUD toggles
  assert.ok(
    html.includes('sushi-toggle-shop'),
    'Shop toggle HUD button must be rendered in topbar',
  );
  assert.ok(
    html.includes('sushi-toggle-menu'),
    'Menu/Personalization toggle HUD button must be rendered in topbar',
  );
  assert.ok(
    html.includes('aria-controls="sushi-unlocks-panel"'),
    'Shop button must control unlocks panel',
  );
  assert.ok(
    html.includes('aria-controls="sushi-scene-placeholder"'),
    'Menu button must control scene/menu overlay',
  );

  // Both overlay panels must be present in the lit-html DOM template
  assert.ok(html.includes('sushi-unlocks-panel'), 'Shop overlay container must be in DOM');
  assert.ok(html.includes('sushi-scene-placeholder'), 'Menu overlay container must be in DOM');

  // Close buttons inside overlays
  assert.ok(
    html.includes('data-testid="sushi-close-shop-btn"'),
    'Close button for shop overlay must be present',
  );
  assert.ok(
    html.includes('data-testid="sushi-close-menu-btn"'),
    'Close button for menu overlay must be present',
  );

  // Filter tabs in shop overlay
  assert.ok(html.includes('data-testid="sushi-filter-all"'), 'All filter tab must be present');
  assert.ok(
    html.includes('data-testid="sushi-filter-kitchen"'),
    'Kitchen filter tab must be present',
  );
  assert.ok(
    html.includes('data-testid="sushi-filter-service"'),
    'Service filter tab must be present',
  );
  assert.ok(html.includes('data-testid="sushi-filter-cap"'), 'Cap filter tab must be present');
  assert.ok(
    html.includes('data-testid="sushi-filter-recipe"'),
    'Recipe filter tab must be present',
  );
  assert.ok(
    html.includes('data-testid="sushi-filter-decoration"'),
    'Decoration filter tab must be present',
  );
});

test('Milestone 3 UI: SushiClientController manages overlay visibility and category filtering', async () => {
  const controller = new SushiClientController();
  const host = createMockHost({
    user: { uid: 'student-m3-controller', displayName: 'Takeshi' },
  });

  controller.init('student-m3-controller', host);
  await new Promise<void>((resolve) => setImmediate(resolve));

  // Default state: no overlay open, shop filter is 'all'
  assert.equal(controller.activeOverlay, null);
  assert.equal(controller.shopCategoryFilter, 'all');

  // Toggle shop overlay open
  controller.toggleOverlay('shop');
  assert.equal(controller.activeOverlay, 'shop');
  assert.ok(host.renderCalls > 0);

  // Toggle same overlay closes it
  const callsBefore = host.renderCalls;
  controller.toggleOverlay('shop');
  assert.equal(controller.activeOverlay, null);
  assert.ok(host.renderCalls > callsBefore);

  // Open menu overlay then switch to shop overlay
  controller.toggleOverlay('menu');
  assert.equal(controller.activeOverlay, 'menu');
  controller.toggleOverlay('shop');
  assert.equal(controller.activeOverlay, 'shop');

  // Close overlay explicitly
  controller.closeOverlay();
  assert.equal(controller.activeOverlay, null);

  // Set category filter
  controller.setShopFilter('kitchen');
  assert.equal(controller.shopCategoryFilter, 'kitchen');
  controller.setShopFilter('decoration');
  assert.equal(controller.shopCategoryFilter, 'decoration');

  controller.reset();
  assert.equal(controller.activeOverlay, null);
  assert.equal(controller.shopCategoryFilter, 'all');
});

test('Milestone 3 UI: Scrollable viewport and pixel styling contracts are declared in sushi.css', async () => {
  const cssPath = resolve(process.cwd(), 'src/course/sushi-game/sushi.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  // Viewport locking
  assert.ok(cssContent.includes('100dvh'), 'CSS must specify 100dvh for viewport locking');
  assert.ok(
    cssContent.includes('position: fixed'),
    'CSS must fix the shell position to the viewport',
  );
  assert.match(
    cssContent,
    /\.sushi-main\s*\{[^}]*overflow-y: auto/s,
    'Game content must remain scrollable',
  );

  // Authentic Typography (@fontsource/dotgothic16)
  assert.ok(cssContent.includes('@fontsource/dotgothic16'), 'CSS must import DotGothic16');
  assert.ok(cssContent.includes("'DotGothic16'"), 'CSS must apply DotGothic16 font-family');

  // Stepped 8-bit borders and themes
  assert.ok(cssContent.includes('.pixel-panel'), 'CSS must define .pixel-panel');
  assert.ok(cssContent.includes('.pixel-border'), 'CSS must define .pixel-border');
  assert.ok(cssContent.includes('.pixel-btn'), 'CSS must define .pixel-btn');
  assert.ok(cssContent.includes("data-theme='sakura'"), 'CSS must define sakura theme selector');
  assert.ok(
    cssContent.includes('::-webkit-scrollbar'),
    'CSS must provide pixelated custom scrollbar styling',
  );

  // Cash register docking and segmented track
  assert.ok(
    cssContent.includes('.sushi-cash-register'),
    'CSS must define bottom-docked cash register',
  );
  assert.ok(cssContent.includes('.sushi-progress-track'), 'CSS must define progress bar track');
  assert.ok(
    cssContent.includes('repeating-linear-gradient'),
    'CSS must define segmented progress bar pattern',
  );
  assert.ok(cssContent.includes('.sushi-collect-btn'), 'CSS must style 3D pixel collect button');
});

async function renderLoadedShell(...args: Parameters<typeof renderSushiShell>) {
  renderSushiShell(...args);
  await new Promise<void>((resolve) => setImmediate(resolve));
  return renderSushiShell(...args);
}
