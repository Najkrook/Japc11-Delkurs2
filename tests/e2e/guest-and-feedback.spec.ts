import { test, expect } from '@playwright/test';

test.describe('Gästhantering och feedback i Arena, toppmeny och talsyntes', () => {
  test('Arena visar tydlig spärrsida när användaren är oinloggad och blockerar lobbyn', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    // Kontrollera att menyn visar låsikon för oinloggade
    const arenaNavBtn = page.locator('[data-course-nav="arena"]');
    await expect(arenaNavBtn).toBeVisible();
    await expect(arenaNavBtn).toHaveClass(/is-locked/);
    await expect(arenaNavBtn).toContainText('🔒');

    // Navigera till Arenan
    await arenaNavBtn.click();

    // 1. Verifiera spärrsidan (auth gate)
    const authGate = page.locator('[data-testid="arena-auth-gate"]');
    await expect(authGate).toBeVisible();
    await expect(authGate).toContainText('Logga in för att gå in i Kurs-Arena');
    await expect(authGate).toContainText('INLOGGNING KRÄVS');

    const loginBtn = page.locator('[data-testid="arena-login-gate-btn"]');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toHaveText('Logga in med Google');

    // 2. Verifiera att lobbyn och matchskapande inte är tillgängliga
    await expect(page.locator('[data-arena-action="create-room"]')).not.toBeVisible();
    await expect(page.locator('main h1')).not.toContainText('Tävla i det nya kursmaterialet');

    expect(errors).toEqual([]);
  });

  test('Talsyntesfeedback visas när enheten saknar japansk röst', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Injicera en mock för SpeechSynthesis och SpeechSynthesisUtterance som enbart har engelska röster (saknar ja-JP)
    await page.addInitScript(() => {
      const mockVoice = {
        lang: 'en-US',
        name: 'English Voice',
        default: true,
        localService: true,
        voiceURI: 'en-voice',
      };
      const synth = {
        getVoices: () => [mockVoice],
        speak: (_utterance: unknown) => {},
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
      Object.defineProperty(window, 'speechSynthesis', {
        value: synth,
        configurable: true,
        writable: true,
      });

      if (!('SpeechSynthesisUtterance' in window)) {
        class MockUtterance {
          text: string;
          lang = '';
          rate = 1;
          voice = null;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor(text: string) {
            this.text = text;
          }
        }
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: MockUtterance,
          configurable: true,
          writable: true,
        });
      }
    });

    await page.goto('/');

    // Gå till Glosor
    await page.getByRole('button', { name: 'Glosor', exact: true }).click();

    // Klicka på Lyssna på gloskortet
    const ttsButton = page.getByRole('button', { name: '🔊 Lyssna' });
    await expect(ttsButton).toBeVisible();
    await ttsButton.click();

    // Verifiera att speech-toast dyker upp
    const toast = page.locator('[data-testid="speech-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Din enhet saknar japansk talsyntesröst');

    // Verifiera att även status i footern uppdateras
    await expect(page.locator('.course-footer')).toContainText(
      'Din enhet saknar japansk talsyntesröst',
    );

    // Stäng toasten via krysset
    await page.locator('.course-speech-toast-dismiss').click();
    await expect(toast).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Inloggningsfel renderas i anslutning till kontoknappen i toppmenyn', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    // Klicka på Logga in i toppmenyn (avbryts / misslyckas i testmiljö utan Google popup)
    const loginButton = page.locator('.course-account-btn');
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // Verifiera att felmeddelandet dyker upp i anslutning till kontoknappen i toppmenyn
    const errorBadge = page.locator('[data-testid="course-account-error"]');
    await expect(errorBadge).toBeVisible();
    await expect(errorBadge).toContainText('Inloggning avbröts');

    // Klicka på stäng-krysset på felmeddelandet
    await page.locator('.course-account-error-badge .error-dismiss-btn').click();
    await expect(errorBadge).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
