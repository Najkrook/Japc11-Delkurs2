/**
 * Konfiguration och kontroller för Sushirestaurangen.
 *
 * Enligt Ticket 02 och releaseuppgiften (Ticket 12) hålls produktionsingången till
 * spelet otillgänglig tills backend och åtkomstregler har publicerats.
 *
 * I utvecklingsmiljö (DEV), testmiljö (MODE === 'test'), på localhost
 * eller när preview uttryckligen aktiveras (via window.__SUSHI_ENTRY_ENABLED,
 * sessionStorage eller URL-parameter) exponeras ingången från studieappen.
 */

/**
 * Kontrollerar om angivet fönster/värd körs i lokal miljö (localhost / 127.0.0.1 / [::1]).
 */
export function isLocalhost(windowObj?: Window): boolean {
  try {
    const win = windowObj ?? (typeof window !== 'undefined' ? window : undefined);
    const hostname = win?.location?.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      Boolean(hostname?.endsWith('.localhost'))
    );
  } catch {
    return false;
  }
}

export function isSushiEntryAvailable(windowObj?: Window): boolean {
  const win = windowObj ?? (typeof window !== 'undefined' ? window : undefined);

  // 1. Explicit fönster-override (för E2E-tester och manuell växling)
  if (
    win &&
    (win as unknown as { __SUSHI_ENTRY_ENABLED?: boolean }).__SUSHI_ENTRY_ENABLED !== undefined
  ) {
    return Boolean((win as unknown as { __SUSHI_ENTRY_ENABLED?: boolean }).__SUSHI_ENTRY_ENABLED);
  }

  // 2. URL-parameter: ?sushi=1 eller ?sushi=true
  try {
    const search = win?.location?.search || '';
    if (search.includes('sushi=1') || search.includes('sushi=true')) {
      return true;
    }
  } catch {
    // Ignore URL-accessfel i begränsade miljöer
  }

  // 3. SessionStorage-flagga: japc11-sushi-entry=true
  try {
    if (win?.sessionStorage?.getItem('japc11-sushi-entry') === 'true') {
      return true;
    }
  } catch {
    // Ignore storage-fel
  }

  // 4. Lokal miljö (localhost / 127.0.0.1)
  if (isLocalhost(win)) {
    return true;
  }

  // 5. Utvecklings- och testläge i Vite
  const metaEnv = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env;
  if (metaEnv?.DEV || metaEnv?.MODE === 'test') {
    return true;
  }

  // 6. Testläge i Node (t.ex. node --test)
  if (
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' ||
      process.env.npm_lifecycle_event === 'test' ||
      Boolean(process.env.TEST_NAME))
  ) {
    return true;
  }

  // 7. I skarp produktion hålls ingången dold tills release (Ticket 12)
  return false;
}
