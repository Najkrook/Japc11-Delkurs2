import { html } from 'lit-html';
import type { CourseHostContext, CourseSubView, CourseTemplate } from './types.ts';
import { courseWeeks, getCourseWeekById } from './data/index.ts';
import { getWeekProgressSummary } from './course-state.ts';
import { studyDrills } from './study-drills.ts';
import { createCourseProgress } from './course-progress.ts';
import { renderTeFormDojo } from './components/te-form-dojo.ts';
import {
  renderGrammarModule,
  renderKanjiModule,
  renderVocabModule,
  resetKanjiMode,
} from './components/flashcard-deck.ts';
import { renderWeekQuizModule } from './components/week-quiz.ts';
import { renderCourseArenaModule } from './components/course-arena.ts';
import { renderHubStampBadge, renderMiniStamp } from './components/stamp-medal.ts';
import { courseProgressPersistence } from '../cloud.ts';
import { isSushiEntryAvailable, SUSHI_GAME_ENABLED } from './sushi-game/config.ts';

type ExtraStudiesModule = typeof import('./components/extra-studies.ts');
let extraStudiesModule: ExtraStudiesModule | null = null;
let extraStudiesLoadingPromise: Promise<ExtraStudiesModule> | null = null;
let extraStudiesLoadError: Error | null = null;

export function loadExtraStudiesModule(host?: CourseHostContext): Promise<ExtraStudiesModule> {
  if (extraStudiesModule) {
    return Promise.resolve(extraStudiesModule);
  }
  if (extraStudiesLoadingPromise) {
    return extraStudiesLoadingPromise;
  }
  extraStudiesLoadError = null;
  extraStudiesLoadingPromise = import('./components/extra-studies.ts')
    .then((mod) => {
      extraStudiesModule = mod;
      extraStudiesLoadingPromise = null;
      host?.render();
      return mod;
    })
    .catch((err) => {
      extraStudiesLoadError = err instanceof Error ? err : new Error(String(err));
      extraStudiesLoadingPromise = null;
      host?.render();
      throw err;
    });
  return extraStudiesLoadingPromise;
}

function renderExtraStudiesPlaceholder(host: CourseHostContext): CourseTemplate {
  if (!extraStudiesModule && !extraStudiesLoadingPromise && !extraStudiesLoadError) {
    loadExtraStudiesModule(host).catch(() => {});
  }

  if (extraStudiesLoadError) {
    return html`
      <div class="course-loading course-loading-error" role="alert">
        <p>Kunde inte ladda extra studiematerial.</p>
        <button
          type="button"
          class="course-btn-primary"
          @click=${() => {
            extraStudiesLoadError = null;
            loadExtraStudiesModule(host).catch(() => {});
            host.render();
          }}
        >
          Försök igen
        </button>
      </div>
    `;
  }

  return html`
    <div class="course-loading" role="status" aria-live="polite">
      <div class="course-loading-spinner" aria-hidden="true"></div>
      <div>Laddar extra studiematerial...</div>
    </div>
  `;
}

type SushiGameModule = typeof import('./sushi-game/sushi-view.ts');
let sushiGameModule: SushiGameModule | null = null;
let sushiGameLoadingPromise: Promise<SushiGameModule> | null = null;
let sushiGameLoadError: Error | null = null;

export function loadSushiGameModule(host?: CourseHostContext): Promise<SushiGameModule> {
  // A literal false in production also removes the dynamic import from the bundle.
  if (!SUSHI_GAME_ENABLED || !isSushiEntryAvailable()) {
    return Promise.reject(new Error('Sushirestaurangen är inte tillgänglig.'));
  }
  if (sushiGameModule) {
    return Promise.resolve(sushiGameModule);
  }
  if (sushiGameLoadingPromise) {
    return sushiGameLoadingPromise;
  }
  sushiGameLoadError = null;
  sushiGameLoadingPromise = import('./sushi-game/sushi-view.ts')
    .then((mod) => {
      sushiGameModule = mod;
      sushiGameLoadingPromise = null;
      host?.render();
      return mod;
    })
    .catch((err) => {
      sushiGameLoadError = err instanceof Error ? err : new Error(String(err));
      sushiGameLoadingPromise = null;
      host?.render();
      throw err;
    });
  return sushiGameLoadingPromise;
}

export function resetSushiGameModuleForTesting(): void {
  sushiGameModule = null;
  sushiGameLoadingPromise = null;
  sushiGameLoadError = null;
}

function renderSushiLoadingPlaceholder(
  host: CourseHostContext,
  onBack: () => void,
): CourseTemplate {
  return html`
    <div class="sushi-shell sushi-loading-shell" data-theme=${host.theme}>
      <header class="sushi-topbar">
        <div class="sushi-topbar-inner">
          <div class="sushi-topbar-left">
            <button
              type="button"
              class="sushi-back-btn"
              data-testid="sushi-loading-back-btn"
              @click=${onBack}
            >
              ← Tillbaka till studierna
            </button>
          </div>
          <div class="sushi-topbar-center">
            <h1 class="sushi-title" lang="ja">🍣 Sushirestaurang</h1>
          </div>
          <div class="sushi-topbar-right"></div>
        </div>
      </header>
      <main class="sushi-main">
        <div class="sushi-loading" role="status" aria-live="polite">
          <div class="sushi-loading-spinner" aria-hidden="true"></div>
          <div>Laddar sushirestaurangen...</div>
        </div>
      </main>
    </div>
  `;
}

function renderSushiLoadingError(host: CourseHostContext, onBack: () => void): CourseTemplate {
  return html`
    <div class="sushi-shell sushi-error-shell" data-theme=${host.theme}>
      <header class="sushi-topbar">
        <div class="sushi-topbar-inner">
          <div class="sushi-topbar-left">
            <button
              type="button"
              class="sushi-back-btn"
              data-testid="sushi-error-back-btn"
              @click=${onBack}
            >
              ← Tillbaka till studierna
            </button>
          </div>
          <div class="sushi-topbar-center">
            <h1 class="sushi-title" lang="ja">🍣 Sushirestaurang</h1>
          </div>
          <div class="sushi-topbar-right"></div>
        </div>
      </header>
      <main class="sushi-main">
        <div
          class="sushi-loading sushi-loading-error"
          role="alert"
          data-testid="sushi-loading-error"
        >
          <p>Kunde inte ladda sushirestaurangen.</p>
          <div class="sushi-error-actions">
            <button
              type="button"
              class="sushi-btn-primary"
              data-testid="sushi-retry-btn"
              @click=${() => {
                sushiGameLoadError = null;
                loadSushiGameModule(host).catch(() => {});
                host.render();
              }}
            >
              Försök igen
            </button>
            <button
              type="button"
              class="sushi-btn-secondary"
              data-testid="sushi-error-back-btn-action"
              @click=${onBack}
            >
              ← Tillbaka till studierna
            </button>
          </div>
        </div>
      </main>
    </div>
  `;
}

export const courseProgress = createCourseProgress(courseProgressPersistence, studyDrills.reset);

const sessionBaselineMedals = new Map<string, string | null>();
let hasInitializedSessionBaseline = false;
const newlyAwardedWeeks = new Set<string>();

function rankMedal(m: string | null): number {
  if (m === 'gold') return 3;
  if (m === 'silver') return 2;
  if (m === 'bronze') return 1;
  return 0;
}

function updateMedalCelebration(progress: ReturnType<typeof courseProgress.snapshot>): void {
  for (const w of courseWeeks) {
    const sum = getWeekProgressSummary(progress, w);
    const curr = sum.medal;
    if (!hasInitializedSessionBaseline) {
      sessionBaselineMedals.set(w.id, curr);
    } else {
      const prev = sessionBaselineMedals.get(w.id) ?? null;
      if (rankMedal(curr) > rankMedal(prev)) {
        newlyAwardedWeeks.add(w.id);
        sessionBaselineMedals.set(w.id, curr);
      } else if (rankMedal(curr) < rankMedal(prev)) {
        sessionBaselineMedals.set(w.id, curr);
        newlyAwardedWeeks.delete(w.id);
      }
    }
  }
  hasInitializedSessionBaseline = true;
}

export function selectCourseWeek(weekId: string, host?: CourseHostContext): void {
  courseProgress.update({ type: 'week', weekId });
  host?.render();
}

export function selectCourseSubView(subView: CourseSubView, host?: CourseHostContext): void {
  if (subView === 'sushi' && !isSushiEntryAvailable()) subView = 'hub';
  if (subView !== 'kanji') {
    resetKanjiMode();
  }
  courseProgress.update({ type: 'subview', subView });
  if (subView === 'extra' && !extraStudiesModule) {
    loadExtraStudiesModule(host).catch(() => {});
  }
  if (subView === 'sushi' && !sushiGameModule) {
    loadSushiGameModule(host).catch(() => {});
  }
  host?.render();
}

export function renderCourseShell(host: CourseHostContext): CourseTemplate {
  let progress = courseProgress.snapshot();
  // Old local/cloud progress may still reopen the restaurant without a URL.
  if (progress.activeSubView === 'sushi' && !isSushiEntryAvailable()) {
    courseProgress.update({ type: 'subview', subView: 'hub' });
    progress = courseProgress.snapshot();
  }
  updateMedalCelebration(progress);
  const week = getCourseWeekById(progress.activeWeekId);
  const summary = getWeekProgressSummary(progress, week);
  const subView = progress.activeSubView;

  if (subView === 'sushi') {
    const goBackToStudies = () => {
      selectCourseSubView('hub', host);
    };

    const onNavigateToChapter = (_lessonNumber: number, weekId: string) => {
      selectCourseWeek(weekId, host);
      selectCourseSubView('hub', host);
    };

    if (sushiGameLoadError) {
      return renderSushiLoadingError(host, goBackToStudies);
    }
    if (!sushiGameModule) {
      loadSushiGameModule(host).catch(() => {});
      return renderSushiLoadingPlaceholder(host, goBackToStudies);
    }
    return sushiGameModule.renderSushiShell(
      { ...host, ensureCourseSynced: courseProgress.ensureCloudSynced },
      goBackToStudies,
      progress,
      onNavigateToChapter,
    );
  }

  sushiGameModule?.leaveSushiView();
  const goHub = () => selectCourseSubView('hub', host);

  return html`
    <div class="course-app-shell" data-course-theme=${host.theme}>
      <!-- ================= TOP APP BAR (Alternativ 2 Layout + Mashup Palette) ================= -->
      <header class="course-topbar">
        <div class="course-topbar-inner">
          <div class="course-topbar-left">
            <button
              type="button"
              class="course-brand-btn"
              @click=${goHub}
              title="Gå till kapitelöversikten"
            >
              <span class="course-brand-glyph" lang="ja">語</span>
              <span class="course-brand-text">
                <strong>JAPC11 · Delkurs 2</strong>
                <small>GENKI I · KAPITEL 6–12</small>
              </span>
            </button>
          </div>

          <nav class="course-top-nav" aria-label="Kursplugg snabblänkar">
            <button
              type="button"
              class="course-top-link ${subView === 'hub' ? 'active' : ''}"
              @click=${goHub}
            >
              Översikt
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'vocab' ? 'active' : ''}"
              @click=${() => selectCourseSubView('vocab', host)}
            >
              Glosor
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'dojo' ? 'active' : ''}"
              @click=${() => selectCourseSubView('dojo', host)}
            >
              て-form Dojo
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'grammar' ? 'active' : ''}"
              @click=${() => selectCourseSubView('grammar', host)}
            >
              Grammatikregler
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'kanji' ? 'active' : ''}"
              @click=${() => selectCourseSubView('kanji', host)}
            >
              Kanji
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'quiz' ? 'active' : ''}"
              @click=${() => selectCourseSubView('quiz', host)}
            >
              Tentafokus
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'extra' ? 'active' : ''}"
              data-course-nav="extra-top"
              @click=${() => selectCourseSubView('extra', host)}
            >
              Extra studier
            </button>
            <button
              type="button"
              class="course-top-link arena-nav-pill ${subView === 'arena' ? 'active' : ''} ${!host.user ? 'is-locked' : ''}"
              data-course-nav="arena"
              title=${host.user ? 'Kurs-Arena' : 'Kurs-Arena (Kräver inloggning)'}
              @click=${() => selectCourseSubView('arena', host)}
            >
              Kurs-Arena
              ${!host.user ? html`<span class="nav-lock-badge" aria-hidden="true">🔒</span>` : ''}
            </button>
            ${
              isSushiEntryAvailable()
                ? html`
                    <button
                      type="button"
                      class="course-top-link sushi-nav-pill"
                      data-course-nav="sushi"
                      title="Sushirestaurang"
                      @click=${() => selectCourseSubView('sushi', host)}
                    >
                      🍣 Restaurang
                    </button>
                  `
                : ''
            }
          </nav>

          <div class="course-topbar-right">
            <button
              type="button"
              class="course-icon-btn"
              @click=${() => host.toggleTheme()}
              title=${
                host.theme === 'sakura'
                  ? 'Växla till Washi & Matcha-tema'
                  : 'Slå på Sakura / Kawaii-tema'
              }
            >
              ${host.theme === 'sakura' ? '🍵 Washi' : '🌸 Sakura'}
            </button>

            <div class="course-account-wrapper">
              <button
                type="button"
                class="course-account-btn ${host.user ? 'logged-in' : ''} ${host.user?.photoURL ? 'has-avatar' : ''}"
                ?disabled=${host.authBusy}
                @click=${host.account}
                title=${
                  host.user
                    ? `Inloggad som ${host.user.displayName || host.user.email || 'användare'} · Klicka för att logga ut`
                    : 'Logga in med Google'
                }
              >
                ${
                  host.user
                    ? html`
                        ${
                          host.user.photoURL
                            ? html`<img
                                class="course-account-avatar"
                                src=${host.user.photoURL}
                                alt=""
                                referrerpolicy="no-referrer"
                                loading="lazy"
                              />`
                            : html`<span class="course-account-fallback-avatar">
                                ${
                                  host.user.displayName
                                    ? host.user.displayName.trim().charAt(0).toUpperCase()
                                    : '👤'
                                }
                              </span>`
                        }
                        <span class="course-account-name">${host.user.displayName || 'Konto'}</span>
                      `
                    : 'Logga in'
                }
              </button>

              ${
                host.authError
                  ? html`
                      <div
                        class="course-account-error-badge"
                        role="alert"
                        data-testid="course-account-error"
                      >
                        <span class="error-text">⚠️ ${host.authError}</span>
                        <button
                          type="button"
                          class="error-dismiss-btn"
                          aria-label="Stäng meddelande"
                          @click=${() => host.clearAuthError?.()}
                        >
                          ×
                        </button>
                      </div>
                    `
                  : ''
              }
            </div>
          </div>
        </div>
      </header>

      <!-- ================= MAIN WORKSPACE WITH LEFT SIDEBAR ================= -->
      <div class="course-workspace-grid">
        <aside class="course-sidebar" aria-label="Kursmeny och kapitelöversikt">
          <div class="course-sidebar-top">
            <!-- View Switcher Pill Tray (Kapitelöversikt vs Kurs-Arena) -->
            <div
              class="course-mode-switcher"
              role="group"
              aria-label="Växla mellan Studieplan och Kurs-Arena"
            >
              <button
                type="button"
                class="mode-switch-pill ${subView !== 'arena' ? 'active' : ''}"
                @click=${goHub}
              >
                <span class="mode-dot"></span>
                Studieplan
              </button>
              <button
                type="button"
                class="mode-switch-pill ${subView === 'arena' ? 'active' : ''} ${!host.user ? 'is-locked' : ''}"
                title=${host.user ? 'Arena' : 'Arena (Kräver inloggning)'}
                @click=${() => selectCourseSubView('arena', host)}
              >
                Arena
                ${!host.user ? html`<span class="pill-lock-icon" aria-hidden="true">🔒</span>` : ''}
              </button>
            </div>

            <div class="course-sidebar-section-label">KAPITEL 6–12</div>

            <!-- Vertical Navigation Timeline (Roadmap) -->
            <div class="course-week-ribbon" role="tablist" aria-label="Välj kapitel">
              ${courseWeeks.map((w) => {
                const wSum = getWeekProgressSummary(progress, w);
                const isActive = subView !== 'extra' && subView !== 'arena' && w.id === week.id;
                const shortTitle = w.titleSv.includes(':')
                  ? w.titleSv.split(':')[1].trim()
                  : w.titleSv.includes('—')
                    ? w.titleSv.split('—')[1].trim()
                    : `Kapitel ${w.lessonNumber}`;
                return html`
                  <button
                    type="button"
                    role="tab"
                    aria-selected=${isActive ? 'true' : 'false'}
                    class="course-week-tab ${isActive ? 'active' : ''} ${w.isPreview ? 'preview' : ''}"
                    @click=${() => {
                      selectCourseWeek(w.id, host);
                      if (subView === 'arena' || subView === 'extra')
                        selectCourseSubView('hub', host);
                    }}
                  >
                    <div class="week-tab-row">
                      <span class="week-tab-indicator ${isActive ? 'active' : ''}">
                        ${isActive ? '◉' : w.isPreview ? '🔒' : '○'}
                      </span>
                      <div class="week-tab-body">
                        <div class="week-tab-head">
                          <strong class="week-tab-title"> Kapitel ${w.lessonNumber} </strong>
                          <span class="week-tab-pct">
                            ${renderMiniStamp(wSum.medal)} ${wSum.overallPercent}%
                          </span>
                        </div>
                        <span class="week-tab-sub">${shortTitle}</span>
                        <div class="week-tab-bar">
                          <span style="width: ${wSum.overallPercent}%"></span>
                        </div>
                      </div>
                    </div>
                  </button>
                `;
              })}
            </div>

            <!-- Extra studier Section -->
            <div class="course-sidebar-section-label">EXTRA STUDIER</div>
            <div class="course-week-ribbon" role="tablist" aria-label="Extra studier">
              <button
                type="button"
                role="tab"
                data-course-nav="extra"
                aria-selected=${subView === 'extra' ? 'true' : 'false'}
                class="course-week-tab course-extra-tab ${subView === 'extra' ? 'active' : ''}"
                @click=${() => selectCourseSubView('extra', host)}
              >
                <div class="week-tab-row">
                  <span class="week-tab-indicator ${subView === 'extra' ? 'active' : ''}">
                    ${subView === 'extra' ? '◉' : '🎴'}
                  </span>
                  <div class="week-tab-body">
                    <div class="week-tab-head">
                      <strong class="week-tab-title">Extra studier</strong>
                      <span class="week-tab-pct extra-tag">Anki</span>
                    </div>
                    <span class="week-tab-sub">Tae Kim Anki · 2 075 kort</span>
                  </div>
                </div>
              </button>
            </div>

            ${
              isSushiEntryAvailable()
                ? html`
                    <div class="course-sidebar-section-label">RESTAURANG</div>
                    <div class="course-week-ribbon" role="tablist" aria-label="Sushirestaurang">
                      <button
                        type="button"
                        role="tab"
                        data-course-nav="sushi-sidebar"
                        class="course-week-tab course-sushi-tab"
                        @click=${() => selectCourseSubView('sushi', host)}
                      >
                        <div class="week-tab-row">
                          <span class="week-tab-indicator"> 🍣 </span>
                          <div class="week-tab-body">
                            <div class="week-tab-head">
                              <strong class="week-tab-title">Sushirestaurang</strong>
                              <span class="week-tab-pct sushi-tag">Tycoon</span>
                            </div>
                            <span class="week-tab-sub">Egen restaurang · Idle & dekoration</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  `
                : ''
            }
          </div>

          <!-- Bottom Sticky Section: Multiplayer Arena & Quick Links -->
          <div class="course-sidebar-bottom">
            <button
              type="button"
              class="course-sidebar-arena-pill ${subView === 'arena' ? 'active' : ''} ${!host.user ? 'is-locked' : ''}"
              title=${host.user ? 'Kurs-Arena' : 'Kurs-Arena (Kräver inloggning)'}
              @click=${() => selectCourseSubView('arena', host)}
            >
              <span class="arena-pill-text">
                <strong
                  >Kurs-Arena
                  ${!host.user ? html`<span class="pill-lock-icon" aria-hidden="true">🔒</span>` : ''}</strong
                >
                <small>${host.user ? 'Multiplayer · 3 bots redo' : 'Kräver inloggning'}</small>
              </span>
              ${host.user ? html`<span class="arena-live-dot" title="Live"></span>` : ''}
            </button>

            <div class="course-sidebar-links">
              <button
                type="button"
                class="course-sidebar-link ${subView === 'grammar' ? 'active' : ''}"
                @click=${() => selectCourseSubView('grammar', host)}
              >
                Ordbok & Grammatik
              </button>
              <button
                type="button"
                class="course-sidebar-link ${subView === 'quiz' ? 'active' : ''}"
                @click=${() => selectCourseSubView('quiz', host)}
              >
                Kapiteltest & Tentafokus
              </button>
            </div>
          </div>
        </aside>

        <!-- ================= MAIN WORK AREA (Canvas) ================= -->
        <main class="course-main-container" id="main">
          ${
            subView === 'hub'
              ? renderWeekBentoHub(week, summary, host)
              : subView === 'vocab'
                ? renderVocabModule(week, progress, host, courseProgress.update, goHub)
                : subView === 'dojo'
                  ? renderTeFormDojo(week, progress, host, courseProgress.update, goHub)
                  : subView === 'grammar'
                    ? renderGrammarModule(
                        week,
                        host,
                        () => selectCourseSubView('dojo', host),
                        goHub,
                      )
                    : subView === 'kanji'
                      ? renderKanjiModule(week, progress, host, courseProgress.update, goHub)
                      : subView === 'arena'
                        ? renderCourseArenaModule(host, goHub)
                        : subView === 'extra'
                          ? extraStudiesModule
                            ? extraStudiesModule.renderExtraStudiesModule(host, goHub)
                            : renderExtraStudiesPlaceholder(host)
                          : renderWeekQuizModule(week, progress, host, courseProgress.update, goHub)
          }
        </main>
      </div>

      ${
        host.speechNotice
          ? html`
              <div
                class="course-speech-toast"
                role="status"
                aria-live="polite"
                data-testid="speech-toast"
              >
                <span class="course-speech-toast-icon" aria-hidden="true">🔊</span>
                <span class="course-speech-toast-text">${host.speechNotice}</span>
                <button
                  type="button"
                  class="course-speech-toast-dismiss"
                  aria-label="Stäng notis"
                  @click=${() => host.clearSpeechNotice?.()}
                >
                  ✕
                </button>
              </div>
            `
          : ''
      }

      <footer class="course-footer">
        <span>${host.status} · JAPC11 Delkurs 2 (Genki I Kapitel 6–12)</span>
        <div class="course-footer-links">
          <button
            type="button"
            class="course-text-link"
            @click=${() => selectCourseSubView('extra', host)}
          >
            Extra studier (Anki)
          </button>
          <button
            type="button"
            class="course-text-link"
            title=${host.user ? 'Kurs-Arena (Multiplayer kapitel 6–12)' : 'Kurs-Arena (Kräver inloggning)'}
            @click=${() => selectCourseSubView('arena', host)}
          >
            Kurs-Arena (Multiplayer kapitel 6–12)${!host.user ? ' 🔒' : ''}
          </button>
          <button
            type="button"
            class="course-text-link"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            て-form Dojo
          </button>
          ${
            isSushiEntryAvailable()
              ? html`
                  <button
                    type="button"
                    class="course-text-link"
                    data-course-nav="sushi-footer"
                    @click=${() => selectCourseSubView('sushi', host)}
                  >
                    🍣 Sushirestaurang
                  </button>
                `
              : ''
          }
        </div>
      </footer>
    </div>
  `;
}

function getHeroDojoConfig(week: ReturnType<typeof getCourseWeekById>): {
  watermark: string;
  heading: string;
  description: string;
} {
  if (week.lessonNumber === 10) {
    return {
      watermark: 'ない',
      heading: 'Kortform Dojo — Planer med つもり',
      description:
        'Träna ない-form för planer som 行かないつもりです. Jämför med grundformen 行くつもりです i grammatikguiden.',
    };
  }
  if (week.lessonNumber === 11) {
    return {
      watermark: 'た',
      heading: 'た-form Dojo — Aktiviteter & Erfarenheter',
      description:
        'Träna た-formen som bygger uttrycken 〜たり〜たりする och 〜たことがある. Önskemål med たい använder i stället ます-stammen.',
    };
  }
  if (week.lessonNumber === 12) {
    return {
      watermark: 'ない',
      heading: 'ない-form Dojo — Råd & Skyldigheter',
      description:
        'Träna ない-form för 〜ないほうがいい och som grund för 〜なければいけません. Växla till た-form för jakande råd med 〜たほうがいい.',
    };
  }
  if (week.lessonNumber === 7) {
    return {
      watermark: 'て',
      heading: 'て-form Dojo — Pågående handling & Tillstånd (～ています)',
      description:
        'I Kapitel 7 använder vi て-formen tillsammans med います för pågående aktiviteter (食べています) och resulterande tillstånd (結婚しています, 知っています) samt klädesverb.',
    };
  }

  if (week.lessonNumber === 8) {
    return {
      watermark: 'ない',
      heading: 'て-form & Kortform Dojo — Nutid & Nekande (ない-form)',
      description:
        'I Kapitel 8 kombinerar vi て-form med japanskans kortform (普通形) i nutid — särskilt nekande ない-form för att uttrycka åsikter (～と思います) och ～ないでください.',
    };
  }

  if (week.lessonNumber === 9) {
    return {
      watermark: 'た',
      heading: 'て-form & Dåtid Dojo — Kortform i dåtid (た-form)',
      description:
        'Kan du て-formen kan du redan た-formen! I Kapitel 9 byter vi bara て/de mot た/だ (買って → 買った, 読んで → 読んだ) för att bilda dåtid i kortform och bisatser.',
    };
  }

  return {
    watermark: 'て',
    heading: 'て-form Dojo — Böjningsregler & Snabbträning',
    description:
      'Te-formen är nyckeln till att koppla ihop meningar, be om tillåtelse (〜てもいいですか) och uttrycka pågående handlingar (〜ています). Träna de fyra huvudsakliga böjningsmönstren steg för steg.',
  };
}

function renderWeekBentoHub(
  week: ReturnType<typeof getCourseWeekById>,
  summary: ReturnType<typeof getWeekProgressSummary>,
  host: CourseHostContext,
): CourseTemplate {
  const previewVocab = week.vocab[0];
  const topKanji = week.kanji.slice(0, 4);
  const heroConfig = getHeroDojoConfig(week);
  const isNewlyAwarded = newlyAwardedWeeks.has(week.id);
  if (isNewlyAwarded && typeof window !== 'undefined') {
    window.setTimeout(() => newlyAwardedWeeks.delete(week.id), 2500);
  }

  const vocabDonePct = Math.round((summary.vocabDone / Math.max(1, summary.vocabTotal)) * 100);
  const dojoDonePct = Math.round((summary.dojoDone / Math.max(1, summary.dojoTotal)) * 100);

  return html`
    <!-- ================= EDITORIAL HEADER & METRICS STRIP ================= -->
    <section class="course-editorial-header">
      <div class="course-breadcrumb-row">
        <div class="course-breadcrumbs">
          <span>Universitetskurs: Japanska I</span>
          <span class="sep">/</span>
          <strong class="crumb-current">Genki I Kapitel ${week.lessonNumber}</strong>
          ${week.isPreview ? html`<span class="course-badge-preview">Förhandsvisning</span>` : ''}
        </div>

        <div class="course-quick-pill-bar">
          <span class="course-badge-jp" lang="ja">${week.subtitleJp}</span>
          ${
            host.tts && previewVocab
              ? html`
                  <button
                    type="button"
                    class="course-pill-icon-btn"
                    title="Lyssna på kapitlets nyckelord"
                    @click=${(e: Event) =>
                      host.speak(previewVocab.kana, e.currentTarget as HTMLElement)}
                  >
                    Uttal
                  </button>
                `
              : ''
          }
        </div>
      </div>

      <h1 class="course-editorial-title" tabindex="-1">${week.titleSv}</h1>
      <p class="course-hero-desc">${week.themeDescriptionSv}</p>

      <!-- Unified Apple-style Study Metrics Strip -->
      <div class="course-stats-bar">
        <div class="course-stat-cell">
          <div class="stat-meta">
            <span class="stat-label">Glosor</span>
            <strong class="stat-value">
              ${summary.vocabDone} <span class="stat-denom">/ ${summary.vocabTotal}</span>
            </strong>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width: ${vocabDonePct}%"></div>
          </div>
        </div>

        <div class="course-stat-cell">
          <div class="stat-meta">
            <span class="stat-label">て-form & Verb</span>
            <strong class="stat-value">
              ${summary.dojoDone} <span class="stat-denom">/ ${summary.dojoTotal}</span>
            </strong>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill accent" style="width: ${dojoDonePct}%"></div>
          </div>
        </div>

        <div class="course-stat-cell">
          <div class="stat-meta">
            <span class="stat-label">Kapitelframsteg</span>
            <strong class="stat-value ring-value">${summary.overallPercent}%</strong>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill success" style="width: ${summary.overallPercent}%"></div>
          </div>
        </div>
      </div>

      <!-- Authentic Japanese Teacher Seal Stamp (Sensei Stamp / Hanko) -->
      ${renderHubStampBadge(summary, week.lessonNumber, isNewlyAwarded)}
    </section>

    <!-- ================= HERO BANNER: FOCUS MISSION ================= -->
    <section class="course-dojo-hero-banner" aria-label="Dagens fokus: て-form Dojo">
      <div class="dojo-hero-watermark" lang="ja" aria-hidden="true">${heroConfig.watermark}</div>

      <div class="dojo-hero-content">
        <div class="dojo-hero-copy">
          <div class="dojo-hero-badges">
            <span class="badge-dagens-fokus">DAGENS FOKUS</span>
            <span class="badge-sub">
              Genki I Kapitel ${week.lessonNumber} · Verbkonjugation (${week.conjugations.length}
              verb)
            </span>
          </div>
          <h2>${heroConfig.heading}</h2>
          <p>${heroConfig.description}</p>
        </div>

        <div class="dojo-hero-actions">
          <button
            type="button"
            class="course-btn-primary"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            Starta て-form Dojo
          </button>
          <button
            type="button"
            class="course-btn-sage-outline"
            @click=${() => selectCourseSubView('grammar', host)}
          >
            Grammatikregler
          </button>
        </div>
      </div>
    </section>

    <!-- Misstagsbank Callout Banner if there are weak words or verbs -->
    ${
      summary.mistakeVocabCount > 0 || summary.mistakeDojoCount > 0
        ? html`
            <section class="course-misstagsbank-banner" aria-label="Din personliga misstagsbank">
              <div class="misstagsbank-left">
                <span class="misstagsbank-icon">⚠️</span>
                <div>
                  <strong>
                    Misstagsbank: ${summary.mistakeVocabCount} svaga glosor
                    ${summary.mistakeDojoCount ? ` · ${summary.mistakeDojoCount} svaga verb` : ''}
                    att repetera
                  </strong>
                  <p>
                    Glosor och verb du nyligen markerat som svåra eller haft fel på under
                    övningarna. Repetera dem för att säkra momenten inför tentan!
                  </p>
                </div>
              </div>
              <div class="misstagsbank-actions">
                ${
                  summary.mistakeVocabCount > 0
                    ? html`
                        <button
                          type="button"
                          class="course-btn-mistakes"
                          @click=${() => {
                            studyDrills.vocab.selectFilter('mistakes');
                            selectCourseSubView('vocab', host);
                          }}
                        >
                          Repetera svaga ord (${summary.mistakeVocabCount}) →
                        </button>
                      `
                    : ''
                }
                ${
                  summary.mistakeDojoCount > 0
                    ? html`
                        <button
                          type="button"
                          class="course-btn-mistakes secondary"
                          @click=${() => {
                            studyDrills.dojo.selectFilter('mistakes');
                            selectCourseSubView('dojo', host);
                          }}
                        >
                          Repetera svaga verb (${summary.mistakeDojoCount}) →
                        </button>
                      `
                    : ''
                }
              </div>
            </section>
          `
        : ''
    }

    <!-- ================= 3-COLUMN STUDY MODULES ================= -->
    <section class="course-three-col-grid" aria-label="Kapitlets tre studiemoduler">
      <!-- COLUMN 1: KAPITLETS GLOSOR -->
      <article class="course-bento-card bento-vocab">
        <div class="bento-card-main">
          <div class="bento-col-header">
            <div class="bento-col-title">
              <h2>Kapitlets glosor</h2>
            </div>
            <div class="bento-header-badges">
              ${
                summary.mistakeVocabCount > 0
                  ? html`<span class="bento-stat-pill weak-pill"
                      >⚠️ ${summary.mistakeVocabCount} svaga</span
                    >`
                  : ''
              }
              <span class="bento-stat-pill">
                ${summary.vocabDone} / ${summary.vocabTotal} klara
              </span>
            </div>
          </div>

          ${
            previewVocab
              ? html`
                  <div class="bento-mini-flashcard">
                    <div class="mini-card-meta">
                      <span>Ordkort 1 av ${week.vocab.length}</span>
                      <span class="mini-cat-pill">${previewVocab.category}</span>
                    </div>
                    <div class="mini-card-body" lang="ja">
                      <small class="mini-furigana">${previewVocab.kana}</small>
                      <strong class="mini-kanji">${previewVocab.kanji || previewVocab.kana}</strong>
                      <span class="mini-sv">${previewVocab.sv}</span>
                    </div>
                    ${
                      host.tts
                        ? html`
                            <button
                              type="button"
                              class="mini-audio-btn"
                              @click=${(e: Event) =>
                                host.speak(previewVocab.kana, e.currentTarget as HTMLElement)}
                            >
                              Lyssna på uttal
                            </button>
                          `
                        : ''
                    }
                  </div>
                `
              : ''
          }
        </div>

        <div class="bento-card-actions ${summary.mistakeVocabCount > 0 ? 'split' : ''}">
          ${
            summary.mistakeVocabCount > 0
              ? html`
                  <button
                    type="button"
                    class="course-btn-mistakes-mini"
                    @click=${() => {
                      studyDrills.vocab.selectFilter('mistakes');
                      selectCourseSubView('vocab', host);
                    }}
                  >
                    ⚠️ Repetera ${summary.mistakeVocabCount} svaga ord
                  </button>
                `
              : ''
          }
          <button
            type="button"
            class="course-btn-primary ${summary.mistakeVocabCount > 0 ? '' : 'full-width'}"
            @click=${() => selectCourseSubView('vocab', host)}
          >
            Öppna alla gloskort →
          </button>
        </div>
      </article>

      <!-- COLUMN 2: KANJI-KORT -->
      <article class="course-bento-card bento-kanji">
        <div class="bento-card-main">
          <div class="bento-col-header">
            <div class="bento-col-title">
              <h2>Kanji-kort</h2>
            </div>
            <span class="bento-stat-pill">
              ${summary.kanjiDone} / ${summary.kanjiTotal} tecken
            </span>
          </div>

          <div class="bento-kanji-2x2" lang="ja">
            ${topKanji.map(
              (k, idx) => html`
                <div class="kanji-mini-tile ${idx === 0 ? 'featured' : ''}">
                  <small class="stroke-tag">${k.strokes} streck</small>
                  <strong class="kanji-char">${k.kanji}</strong>
                  <span class="kanji-meaning">${k.meaningSv.split('/')[0]}</span>
                  <small class="kanji-reading">${k.kunyomi[0] || k.onyomi[0] || ''}</small>
                </div>
              `,
            )}
          </div>
        </div>

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-primary full-width"
            @click=${() => selectCourseSubView('kanji', host)}
          >
            Studera alla ${week.kanji.length} Kanji →
          </button>
        </div>
      </article>

      <!-- COLUMN 3: VECKOTEST (TENTAFOKUS) -->
      <article class="course-bento-card bento-quiz">
        <div class="bento-card-main">
          <div class="bento-col-header">
            <div class="bento-col-title">
              <h2>Kapiteltest</h2>
            </div>
            <span class="bento-stat-pill exam-pill"> Tentafokus · L${week.lessonNumber} </span>
          </div>

          <div class="bento-exam-summary">
            <div class="exam-summary-top">
              <span class="exam-tag">Diagnostiskt delprov</span>
              <span class="exam-time">${week.quiz.length} frågor</span>
            </div>
            <h3>Kapitel ${week.lessonNumber} Kunskapskontroll</h3>
            <p>
              Testa om kapitlets glosor, verbböjningar, partiklar och läsförståelse sitter med
              direkt förklaring efter varje fråga.
            </p>

            <div class="bento-exam-status">
              <span>Status:</span>
              <strong>
                ${
                  summary.quizScore !== null
                    ? `Bästa resultat: ${summary.quizScore} / ${summary.quizTotal} rätt`
                    : 'Redo att genomföras'
                }
              </strong>
            </div>
          </div>
        </div>

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-primary full-width"
            @click=${() => selectCourseSubView('quiz', host)}
          >
            Starta kapitlets minitest (${week.quiz.length} frågor) →
          </button>
        </div>
      </article>
    </section>
  `;
}
