import { test, expect } from '@playwright/test';

test.describe('Ticket 02: Separat spelvy med Google-inloggning för Sushirestaurangen', () => {
  test('1. Spelkod och spelstilar laddas först när spelvyn öppnas (Lazy loading)', async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    page.on('request', (req) => {
      requestedUrls.push(req.url());
    });

    await page.goto('/');

    // Vänta tills studieappens huvudskal är fullt renderat
    await expect(page.locator('main h1')).toBeVisible();

    // Verifiera att ingen sushimodul, sushistil, typsnitt eller sprite begärdes vid initial sidladdning
    const hadSushiInitially = requestedUrls.some(
      (url) =>
        url.includes('sushi-view') ||
        url.includes('sushi.css') ||
        url.includes('dotgothic16') ||
        url.includes('pixelarticons') ||
        url.includes('/sprites/sushi/'),
    );
    expect(hadSushiInitially).toBe(false);

    // Navigera till sushirestaurangen via ingången i studieappen
    await page.locator('[data-course-nav="sushi"]').click();

    // Verifiera att URL ändras till #/sushi
    await expect(page).toHaveURL(/#\/sushi/);

    // Verifiera att sushiskalet nu har renderats
    await expect(page.locator('[data-testid="sushi-shell"]')).toBeVisible();

    // Verifiera att sushimodulen nu har begärts
    const hasRequestedSushiNow = requestedUrls.some((url) => url.includes('sushi'));
    expect(hasRequestedSushiNow).toBe(true);
  });

  test('2. Åtkomstspärr: Oinloggad gäst blockeras även vid direktlänk och omladdning', async ({
    page,
  }) => {
    // Direktlänk till #/sushi som utloggad besökare
    await page.goto('/#/sushi');

    await expect(page).toHaveURL(/#\/sushi/);

    // Auth gate ska visas
    const authGate = page.locator('[data-testid="sushi-auth-gate"]');
    await expect(authGate).toBeVisible();
    await expect(authGate).toContainText('Logga in för att öppna restaurangen');
    await expect(authGate).toContainText('Gäståtkomst eller demo stöds inte');

    // Ingen spelbar scen eller personlig data ska finnas
    await expect(page.locator('[data-testid="sushi-stage"]')).not.toBeVisible();
    await expect(page.locator('.course-sidebar')).not.toBeVisible();
    await expect(page.locator('.course-top-nav')).not.toBeVisible();

    // Omladdning (F5) på #/sushi behåller spärren
    await page.reload();
    await expect(page).toHaveURL(/#\/sushi/);
    await expect(page.locator('[data-testid="sushi-auth-gate"]')).toBeVisible();
    await expect(page.locator('[data-testid="sushi-stage"]')).not.toBeVisible();

    // Återgå till studierna via knappen på spärrsidan
    await page.locator('[data-testid="sushi-back-btn"]').click();
    await expect(page).toHaveURL(/#\/vecka\/week-1/);
    await expect(page.locator('.course-sidebar')).toBeVisible();
  });

  test('3. Navigering mellan studieappen och restaurangen bevarar kurskontext och historik', async ({
    page,
  }) => {
    // Starta på en specifik vecka och delvy: Vecka 3 (Kapitel 8) Glosor
    await page.goto('/#/vecka/week-3/vocab');
    await expect(page.locator('main h1')).toBeVisible();

    // Gå till restaurangen
    await page.locator('[data-course-nav="sushi"]').click();
    await expect(page).toHaveURL(/#\/sushi/);
    await expect(page.locator('[data-testid="sushi-shell"]')).toBeVisible();

    // Verifiera att studiemenyer och sidomeny är dolda
    await expect(page.locator('.course-sidebar')).not.toBeVisible();
    await expect(page.locator('.course-top-nav')).not.toBeVisible();

    // Klicka på "Tillbaka till studierna" i sushins toppmeny
    await page.locator('[data-testid="sushi-back-to-studies"]').click();

    // Verifiera att vi kommer tillbaka till Vecka 3 (kurskontexten bibehållen)
    await expect(page).toHaveURL(/#\/vecka\/week-3/);
    await expect(page.locator('.course-sidebar')).toBeVisible();

    // Bakåtknapp i webbläsaren ska ta oss till #/sushi
    await page.goBack();
    await expect(page).toHaveURL(/#\/sushi/);
    await expect(page.locator('[data-testid="sushi-shell"]')).toBeVisible();

    // Framåtknapp i webbläsaren ska ta oss till #/vecka/week-3
    await page.goForward();
    await expect(page).toHaveURL(/#\/vecka\/week-3/);
  });

  test('4. Inloggning, utloggning och kontobyte på restaurangsidan isolerar användardata', async ({
    page,
  }) => {
    await page.goto('/#/sushi');

    // Initialt utloggad: spärrsida
    await expect(page.locator('[data-testid="sushi-auth-gate"]')).toBeVisible();

    // Logga in som Sakura
    await page.evaluate(() => {
      const u = {
        uid: 'user-sakura',
        displayName: 'Sakura Kinomoto',
        email: 'sakura@example.com',
      };
      sessionStorage.setItem('japc11-mock-user', JSON.stringify(u));
      (window as unknown as { __setMockUser: (u: unknown) => void }).__setMockUser(u);
    });

    // Spärrsidan ska försvinna och den autentiserade scenen visas med Sakuras namn
    await expect(page.locator('[data-testid="sushi-auth-gate"]')).not.toBeVisible();
    const stage = page.locator('[data-testid="sushi-stage"]');
    await expect(stage).toBeVisible();
    await expect(stage).toContainText('Välkommen, Sakura Kinomoto!');
    await expect(page.locator('[data-testid="sushi-user-name"]')).toContainText('Sakura Kinomoto');

    // Logga ut
    await page.evaluate(() => {
      sessionStorage.removeItem('japc11-mock-user');
      (window as unknown as { __setMockUser: (u: unknown) => void }).__setMockUser(null);
    });

    // Spärrsidan ska återkomma omedelbart och Sakuras uppgifter vara helt borta
    await expect(page.locator('[data-testid="sushi-auth-gate"]')).toBeVisible();
    await expect(page.locator('[data-testid="sushi-stage"]')).not.toBeVisible();
    await expect(page.locator('body')).not.toContainText('Sakura Kinomoto');

    // Kontobyte: Logga in som Shaoran
    await page.evaluate(() => {
      const u = {
        uid: 'user-shaoran',
        displayName: 'Shaoran Li',
        email: 'shaoran@example.com',
      };
      sessionStorage.setItem('japc11-mock-user', JSON.stringify(u));
      (window as unknown as { __setMockUser: (u: unknown) => void }).__setMockUser(u);
    });

    // Verifiera att Shaorans namn visas och ingen tidigare data från Sakura dröjer kvar
    await expect(page.locator('[data-testid="sushi-auth-gate"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sushi-stage"]')).toBeVisible();
    await expect(page.locator('[data-testid="sushi-stage"]')).toContainText(
      'Välkommen, Shaoran Li!',
    );
    await expect(page.locator('body')).not.toContainText('Sakura Kinomoto');
  });

  test('5. Produktionsingång hålls otillgänglig tills backend publiceras, men tillåter preview', async ({
    page,
  }) => {
    // 1. Simulera skarp produktion utan preview
    await page.addInitScript(() => {
      (window as unknown as { __SUSHI_ENTRY_ENABLED: boolean }).__SUSHI_ENTRY_ENABLED = false;
    });

    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();

    // Verifiera att ingen sushiknapp visas i toppmenyn, sidomenyn eller footern
    await expect(page.locator('[data-course-nav="sushi"]')).not.toBeVisible();
    await expect(page.locator('[data-course-nav="sushi-sidebar"]')).not.toBeVisible();
    await expect(page.locator('[data-course-nav="sushi-footer"]')).not.toBeVisible();

    // 2. Simulera aktiverad preview via fönsterflagga
    await page.evaluate(() => {
      (window as unknown as { __SUSHI_ENTRY_ENABLED: boolean }).__SUSHI_ENTRY_ENABLED = true;
      // Trigga omrendering
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // Ladda om med aktiverad preview
    await page.addInitScript(() => {
      (window as unknown as { __SUSHI_ENTRY_ENABLED: boolean }).__SUSHI_ENTRY_ENABLED = true;
    });
    await page.goto('/');
    await expect(page.locator('[data-course-nav="sushi"]')).toBeVisible();
  });

  test('6. Befintliga studievyer fungerar fortsatt utan regression', async ({ page }) => {
    await page.goto('/');

    // 1. Glosor
    await page.locator('nav.course-top-nav button:has-text("Glosor")').click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/vocab/);
    await expect(page.locator('.flashcard-container, .vocab-table-container, main')).toBeVisible();

    // 2. Dojo
    await page.locator('nav.course-top-nav button:has-text("て-form Dojo")').click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/dojo/);
    await expect(page.locator('main h1')).toContainText('Träna verbens て-form steg för steg');

    // 3. Kanji
    await page.locator('nav.course-top-nav button:has-text("Kanji")').click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/kanji/);

    // 4. Tentafokus
    await page.locator('nav.course-top-nav button:has-text("Tentafokus")').click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/quiz/);

    // 5. Extra studier
    await page.locator('[data-course-nav="extra-top"]').click();
    await expect(page).toHaveURL(/#\/extra/);
    await expect(page.locator('main h1')).toContainText('Extra studier · Tae Kim Anime Immersion');
  });

  test('7. På localhost kan användaren öppna restaurangen direkt med testkonto och logga ut', async ({
    page,
  }) => {
    await page.goto('/#/sushi');

    // Auth gate visas med den lokala inloggningsknappen på localhost
    const authGate = page.locator('[data-testid="sushi-auth-gate"]');
    await expect(authGate).toBeVisible();
    const localLoginBtn = page.locator('[data-testid="sushi-local-login-btn"]');
    await expect(localLoginBtn).toBeVisible();

    // Klicka på "Öppna lokalt (testkonto)"
    await localLoginBtn.click();

    // Restaurangen ska öppnas och visa "Lokal student"
    await expect(authGate).not.toBeVisible();
    const stage = page.locator('[data-testid="sushi-stage"]');
    await expect(stage).toBeVisible();
    await expect(stage).toContainText('Välkommen, Lokal student!');
    await expect(page.locator('[data-testid="sushi-user-name"]')).toContainText('Lokal student');

    // Kassa och spelscen laddas
    await expect(page.locator('[data-testid="sushi-cash-register"]')).toBeVisible();

    // Logga ut via kontoknappen i toppmenyn
    await page.locator('.sushi-account-btn.logged-in').click();

    // Spärrsidan ska återkomma
    await expect(page.locator('[data-testid="sushi-auth-gate"]')).toBeVisible();
    await expect(page.locator('[data-testid="sushi-stage"]')).not.toBeVisible();
  });
});
