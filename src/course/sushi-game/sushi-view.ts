import { html, type TemplateResult } from 'lit-html';
import type { CourseHostContext } from '../types.ts';

if (typeof window !== 'undefined') {
  try {
    // @ts-expect-error Dynamic CSS import is handled by Vite for lazy bundling
    void import('./sushi.css');
  } catch {}
}

/**
 * Kontrollerar om den aktuella användaren är en fullvärdig autentiserad Google-användare.
 * Anonyma eller saknade sessioner får ingen tillgång till restaurangen.
 */
function isAuthenticatedGoogleUser(
  user: CourseHostContext['user'],
): user is NonNullable<CourseHostContext['user']> {
  if (!user || !user.uid) return false;
  const rawUser = user as { isAnonymous?: boolean };
  return rawUser.isAnonymous !== true;
}

/**
 * Renderar spärrsidan (Auth Gate) för oinloggade besökare eller anonyma sessioner.
 * Gäståtkomst eller gästdemo tillåts inte enligt Ticket 02.
 */
function renderSushiAuthGate(host: CourseHostContext, onBackToStudies: () => void): TemplateResult {
  const handleLogin = () => {
    if (host.onLogin) {
      host.onLogin();
    } else {
      host.account();
    }
  };

  return html`
    <div
      class="sushi-auth-gate"
      data-testid="sushi-auth-gate"
      role="region"
      aria-label="Inloggningskrav"
    >
      <div class="sushi-auth-card">
        <div class="sushi-auth-icon" aria-hidden="true">🍣🔒</div>
        <h2>Logga in för att öppna restaurangen</h2>
        <p>
          Din sushirestaurang är personlig och kopplas till dina studieresultat i Genki I. Logga in
          med ditt Google-konto för att starta restaurangen och tjäna yen.
        </p>
        <p class="sushi-auth-note">
          Gäståtkomst eller demo stöds inte. Restaurangen kräver ett inloggat Google-konto.
        </p>

        <div class="sushi-auth-actions">
          <button
            type="button"
            class="sushi-btn-primary"
            data-testid="sushi-login-btn"
            ?disabled=${host.authBusy}
            @click=${handleLogin}
          >
            ${host.authBusy ? 'Loggar in...' : 'Logga in med Google'}
          </button>

          <button
            type="button"
            class="sushi-btn-secondary"
            data-testid="sushi-back-btn"
            @click=${onBackToStudies}
          >
            ← Tillbaka till studierna
          </button>
        </div>

        ${
          host.authError
            ? html`
                <div class="sushi-auth-error" role="alert" data-testid="sushi-auth-error">
                  <span>⚠️ ${host.authError}</span>
                  <button type="button" class="sushi-retry-btn" @click=${handleLogin}>
                    Försök igen
                  </button>
                </div>
              `
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * Renderar restaurangens vy för en inloggad student.
 * I Ticket 02 förbereds skalet, autentiseringen och navigeringen; personlig
 * restaurang och ekonomi ansluts i efterföljande tickets utan produktionsmock.
 */
function renderSushiAuthenticatedStage(
  _host: CourseHostContext,
  user: NonNullable<CourseHostContext['user']>,
  onBackToStudies: () => void,
): TemplateResult {
  const displayName = user.displayName || user.email || 'student';

  return html`
    <div class="sushi-container" data-testid="sushi-container">
      <section class="sushi-stage" data-testid="sushi-stage" aria-label="Personlig sushirestaurang">
        <div class="sushi-stage-header">
          <h2>Välkommen, ${displayName}!</h2>
          <p class="sushi-stage-intro">
            Här förbereds din personliga sushirestaurang. Anslutning av restaurang och ekonomi sker
            i nästa steg.
          </p>
        </div>

        <div class="sushi-scene-placeholder" data-testid="sushi-scene-placeholder">
          <div class="sushi-scene-badge">🍣 Personlig restaurang redo att öppnas</div>
          <p class="sushi-scene-desc">
            Ingen lokal demo eller provisorisk mock används. Restaurangdata laddas säkert via
            Google-inloggning.
          </p>
        </div>

        <div class="sushi-stage-actions">
          <button
            type="button"
            class="sushi-btn-secondary"
            data-testid="sushi-stage-back-btn"
            @click=${onBackToStudies}
          >
            ← Återgå till studierna
          </button>
        </div>
      </section>
    </div>
  `;
}

/**
 * Huvudkomponent för sushispelets skal.
 * Ersätter hela studieappens toppmeny och sidomeny med ett eget renodlat spelgränssnitt.
 */
export function renderSushiShell(
  host: CourseHostContext,
  onBackToStudies: () => void,
): TemplateResult {
  const user = host.user;
  const isAuthed = isAuthenticatedGoogleUser(user);

  return html`
    <div
      class="sushi-shell"
      data-theme=${host.theme}
      data-testid="sushi-shell"
      data-authenticated="${isAuthed ? 'true' : 'false'}"
    >
      <!-- Separat toppmeny för restaurangen (inga studiemenyer eller sidomenyer) -->
      <header class="sushi-topbar">
        <div class="sushi-topbar-inner">
          <div class="sushi-topbar-left">
            <button
              type="button"
              class="sushi-back-btn"
              data-testid="sushi-back-to-studies"
              @click=${onBackToStudies}
              title="Tillbaka till studierna"
            >
              ← Tillbaka till studierna
            </button>
          </div>

          <div class="sushi-topbar-center">
            <h1 class="sushi-title" lang="ja">
              <span>🍣</span>
              <span>Sushirestaurang</span>
            </h1>
          </div>

          <div class="sushi-topbar-right">
            <button
              type="button"
              class="sushi-icon-btn"
              @click=${() => host.toggleTheme()}
              title=${
                host.theme === 'sakura'
                  ? 'Växla till Washi & Matcha-tema'
                  : 'Slå på Sakura / Kawaii-tema'
              }
            >
              ${host.theme === 'sakura' ? '🍵 Washi' : '🌸 Sakura'}
            </button>

            ${
              isAuthed
                ? html`
                    <button
                      type="button"
                      class="sushi-account-btn logged-in"
                      ?disabled=${host.authBusy}
                      @click=${host.account}
                      title="Inloggad som ${user.displayName || user.email || 'student'} · Klicka för att logga ut"
                    >
                      ${
                        user.photoURL
                          ? html`<img
                              class="sushi-avatar"
                              src=${user.photoURL}
                              alt=""
                              referrerpolicy="no-referrer"
                            />`
                          : html`<span class="sushi-avatar-fallback">
                              ${(user.displayName || user.email || 'S').trim().charAt(0).toUpperCase()}
                            </span>`
                      }
                      <span class="sushi-user-name" data-testid="sushi-user-name">
                        ${user.displayName || user.email || 'Student'}
                      </span>
                      <span class="sushi-logout-hint">(Logga ut)</span>
                    </button>
                  `
                : html`
                    <button
                      type="button"
                      class="sushi-account-btn"
                      ?disabled=${host.authBusy}
                      @click=${() => (host.onLogin ? host.onLogin() : host.account())}
                    >
                      Logga in
                    </button>
                  `
            }
          </div>
        </div>
      </header>

      <!-- Huvudyta: Auth Gate för oinloggade, Spelscen för inloggade -->
      <main class="sushi-main" id="sushi-main">
        ${
          isAuthed
            ? renderSushiAuthenticatedStage(host, user, onBackToStudies)
            : renderSushiAuthGate(host, onBackToStudies)
        }
      </main>
    </div>
  `;
}
