import { test, expect } from '@playwright/test';

test.describe('Ticket 05: Gästhantering och feedback i Arena, toppmeny och talsyntes', () => {
  test('Arena visar tydlig gästupplysning i lobby och väntrum när användaren är gäst', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    // Navigera till Arenan
    await page.locator('[data-course-nav="arena"]').click();

    // 1. Verifiera gästbannern i lobbyn
    const lobbyBanner = page.locator('[data-testid="arena-guest-banner"]');
    await expect(lobbyBanner).toBeVisible();
    await expect(lobbyBanner).toContainText('Gästläge:');
    await expect(lobbyBanner).toContainText(
      'Detta rum körs lokalt i din webbläsare. För att spela i realtid mot kurskamrater på andra mobiler och datorer, logga in med Google.',
    );

    const lobbyLoginBtn = page.locator('[data-testid="arena-guest-login-btn"]');
    await expect(lobbyLoginBtn).toBeVisible();
    await expect(lobbyLoginBtn).toHaveText('Logga in');

    // 2. Skapa rum och verifiera gästbannern i väntrummet
    await page.locator('[data-arena-action="create-room"]').click();
    await expect(page.locator('[data-testid="arena-room-code"]')).toBeVisible();

    const waitingBanner = page.locator('[data-testid="arena-guest-banner"]');
    await expect(waitingBanner).toBeVisible();
    await expect(waitingBanner).toContainText('Gästläge:');
    await expect(page.locator('[data-testid="arena-guest-login-btn"]')).toBeVisible();

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
