import { html } from 'lit-html';
import type {
  CourseHostContext,
  CourseProgressData,
  CourseSubView,
  CourseTemplate,
} from './types.ts';
import { courseWeeks, getCourseWeekById } from './data/index.ts';
import {
  getWeekProgressSummary,
  readCourseProgress,
  saveCourseProgress,
  setCourseActiveWeek,
  setCourseSubView,
} from './course-state.ts';
import { renderTeFormDojo, resetDojoUiState } from './components/te-form-dojo.ts';
import {
  renderGrammarModule,
  renderKanjiModule,
  renderVocabModule,
  resetDeckUiState,
} from './components/flashcard-deck.ts';
import { renderWeekQuizModule, resetWeekQuizState } from './components/week-quiz.ts';
import { renderCourseArenaModule } from './components/course-arena.ts';

let activeUid: string | null = null;
let courseProgress: CourseProgressData = readCourseProgress(
  typeof localStorage !== 'undefined' ? localStorage : undefined,
  null,
);

export function syncCourseProgressForUser(uid?: string | null): CourseProgressData {
  const normalizedUid = uid || null;
  if (activeUid !== normalizedUid) {
    activeUid = normalizedUid;
    courseProgress = readCourseProgress(
      typeof localStorage !== 'undefined' ? localStorage : undefined,
      activeUid,
    );
  }
  return courseProgress;
}

export function getCourseProgressSnapshot(): CourseProgressData {
  return courseProgress;
}

function persistCourse(): void {
  saveCourseProgress(
    typeof localStorage !== 'undefined' ? localStorage : undefined,
    activeUid,
    courseProgress,
  );
}

export function selectCourseWeek(weekId: string, host?: CourseHostContext): void {
  setCourseActiveWeek(courseProgress, weekId);
  resetDojoUiState();
  resetDeckUiState();
  resetWeekQuizState(weekId);
  persistCourse();
  host?.render();
}

export function selectCourseSubView(subView: CourseSubView, host?: CourseHostContext): void {
  setCourseSubView(courseProgress, subView);
  persistCourse();
  host?.render();
}

export function renderCourseShell(host: CourseHostContext): CourseTemplate {
  syncCourseProgressForUser(host.user?.uid);
  const week = getCourseWeekById(courseProgress.activeWeekId);
  const summary = getWeekProgressSummary(courseProgress, week);
  const subView = courseProgress.activeSubView;

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
              title="Gå till veckoöversikten"
            >
              <span class="course-brand-glyph" lang="ja">語</span>
              <span class="course-brand-text">
                <strong>JAPC11 · Delkurs 2</strong>
                <small>GENKI I · LEKTION 6–9</small>
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
              class="course-top-link arena-nav-pill ${subView === 'arena' ? 'active' : ''}"
              data-course-nav="arena"
              @click=${() => selectCourseSubView('arena', host)}
            >
              ⚔️ Kurs-Arena
            </button>
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

            <button
              type="button"
              class="course-account-btn"
              ?disabled=${host.authBusy}
              @click=${host.account}
            >
              ${host.user ? `👤 ${host.user.displayName || 'Konto'}` : 'Logga in'}
            </button>
          </div>
        </div>
      </header>

      <!-- ================= MAIN WORKSPACE WITH LEFT SIDEBAR (Alternativ 2) ================= -->
      <div class="course-workspace-grid">
        <aside class="course-sidebar" aria-label="Kursmeny och veckoplan">
          <div class="course-sidebar-top">
            <div class="course-sidebar-brand">
              <div class="course-sidebar-crest" lang="ja">語</div>
              <div>
                <strong>JAPC11 · Delkurs 2</strong>
                <span>Genki I · Lektion 6–9</span>
              </div>
            </div>

            <!-- View Switcher Pill Tray (Veckoöversikt vs Kurs-Arena) -->
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
                class="mode-switch-pill ${subView === 'arena' ? 'active' : ''}"
                @click=${() => selectCourseSubView('arena', host)}
              >
                ⚔️ Arena
              </button>
            </div>

            <div class="course-sidebar-section-label">STUDIEPLAN · 4 VECKOR</div>

            <!-- Vertical Navigation Timeline (Roadmap) -->
            <div class="course-week-ribbon" role="tablist" aria-label="Välj kursvecka">
              ${courseWeeks.map((w) => {
                const wSum = getWeekProgressSummary(courseProgress, w);
                const isActive = w.id === week.id;
                const shortTitle = w.titleSv.includes('—')
                  ? w.titleSv.split('—')[1].trim()
                  : `Lektion ${w.lessonNumber}`;
                return html`
                  <button
                    type="button"
                    role="tab"
                    aria-selected=${isActive ? 'true' : 'false'}
                    class="course-week-tab ${isActive ? 'active' : ''} ${w.isPreview ? 'preview' : ''}"
                    @click=${() => {
                      selectCourseWeek(w.id, host);
                      if (subView === 'arena') selectCourseSubView('hub', host);
                    }}
                  >
                    <div class="week-tab-row">
                      <span class="week-tab-indicator ${isActive ? 'active' : ''}">
                        ${isActive ? '◉' : w.isPreview ? '🔒' : '○'}
                      </span>
                      <div class="week-tab-body">
                        <div class="week-tab-head">
                          <strong class="week-tab-title">
                            Vecka ${w.weekNumber} · Lektion ${w.lessonNumber}
                          </strong>
                          <span class="week-tab-pct">${wSum.overallPercent}%</span>
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
          </div>

          <!-- Bottom Sticky Section: Multiplayer Arena & Quick Links -->
          <div class="course-sidebar-bottom">
            <div class="course-sidebar-arena-card">
              <div class="sidebar-arena-meta">
                <span class="live-pill">
                  <span class="live-dot"></span>
                  Live Utmaning
                </span>
                <span class="bot-count">3 studie-bots redo</span>
              </div>
              <h3>⚔️ Kurs-Arena (Multiplayer)</h3>
              <p>Tävla i snabb verbböjning & glosor (Lektion 6–9) i realtid.</p>
              <button
                type="button"
                class="course-sidebar-arena-btn"
                @click=${() => selectCourseSubView('arena', host)}
              >
                Gå med i Arenan →
              </button>
            </div>

            <div class="course-sidebar-links">
              <button
                type="button"
                class="course-sidebar-link"
                @click=${() => selectCourseSubView('grammar', host)}
              >
                📖 Ordbok & Grammatikreferens
              </button>
              <button
                type="button"
                class="course-sidebar-link"
                @click=${() => selectCourseSubView('quiz', host)}
              >
                🏁 Veckotest & Tentafokus
              </button>
            </div>
          </div>
        </aside>

        <!-- ================= MAIN WORK AREA (Canvas) ================= -->
        <main class="course-main-container" id="main">
          ${
            subView === 'hub'
              ? renderWeekBentoHub(week, summary, host, persistCourse)
              : subView === 'vocab'
                ? renderVocabModule(week, courseProgress, host, persistCourse, goHub)
                : subView === 'dojo'
                  ? renderTeFormDojo(week, courseProgress, host, persistCourse, goHub)
                  : subView === 'grammar'
                    ? renderGrammarModule(
                        week,
                        host,
                        () => selectCourseSubView('dojo', host),
                        goHub,
                      )
                    : subView === 'kanji'
                      ? renderKanjiModule(week, courseProgress, host, persistCourse, goHub)
                      : subView === 'arena'
                        ? renderCourseArenaModule(host, goHub)
                        : renderWeekQuizModule(week, courseProgress, host, persistCourse, goHub)
          }
        </main>
      </div>

      <footer class="course-footer">
        <span>${host.status} · JAPC11 Delkurs 2 (Genki I Lektion 6–9)</span>
        <div class="course-footer-links">
          <button
            type="button"
            class="course-text-link"
            @click=${() => selectCourseSubView('arena', host)}
          >
            ⚔️ Kurs-Arena (Multiplayer L6–L9)
          </button>
          <button
            type="button"
            class="course-text-link"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            🥋 て-form Dojo
          </button>
        </div>
      </footer>
    </div>
  `;
}

function renderWeekBentoHub(
  week: ReturnType<typeof getCourseWeekById>,
  summary: ReturnType<typeof getWeekProgressSummary>,
  host: CourseHostContext,
  _onPersist: () => void,
): CourseTemplate {
  const previewVocab = week.vocab[0];
  const nextQueue = week.vocab.slice(1, 4);
  const topKanji = week.kanji.slice(0, 4);
  const firstKanji = week.kanji[0];

  return html`
    <!-- ================= TOP EDITORIAL HEADER & STUDY STATS BAR ================= -->
    <section class="course-editorial-header">
      <div class="course-breadcrumb-row">
        <div class="course-breadcrumbs">
          <span>Universitetskurs: Japanska I</span>
          <span class="sep">/</span>
          <span>Vecka ${week.weekNumber} av 4</span>
          <span class="sep">/</span>
          <strong class="crumb-current">Genki I Kapitel ${week.lessonNumber}</strong>
          ${
            week.isPreview
              ? html`<span class="course-badge-preview">Förhandsvisning + Basövningar</span>`
              : ''
          }
        </div>

        <div class="course-quick-pill-bar">
          <span class="course-badge-jp" lang="ja">${week.subtitleJp}</span>
          ${
            host.tts && previewVocab
              ? html`
                  <button
                    type="button"
                    class="course-pill-icon-btn"
                    title="Lyssna på veckans nyckelord"
                    @click=${(e: Event) =>
                      host.speak(previewVocab.kana, e.currentTarget as HTMLElement)}
                  >
                    🔊 Uttal: PÅ
                  </button>
                `
              : ''
          }
        </div>
      </div>

      <h1 class="course-editorial-title" tabindex="-1">${week.titleSv}</h1>
      <p class="course-hero-desc">${week.themeDescriptionSv}</p>

      <!-- 3-Column Study Summary Stats Bar (Alternativ 2) -->
      <div class="course-stats-bar">
        <div class="course-stat-cell">
          <div class="stat-icon sage">📚</div>
          <div>
            <span class="stat-label">Bemästrade glosor</span>
            <strong class="stat-value">
              ${summary.vocabDone} / ${summary.vocabTotal} st
              <small
                >(${Math.round((summary.vocabDone / Math.max(1, summary.vocabTotal)) * 100)}%)</small
              >
            </strong>
          </div>
        </div>

        <div class="course-stat-cell">
          <div class="stat-icon terracotta">🔥</div>
          <div>
            <span class="stat-label">Verb & て-form Dojo</span>
            <strong class="stat-value terracotta-text">
              ${summary.dojoDone} / ${summary.dojoTotal} verb klara
            </strong>
          </div>
        </div>

        <div class="course-stat-cell">
          <div class="stat-icon sage">✓</div>
          <div>
            <span class="stat-label">Total veckoprogression</span>
            <strong class="stat-value ring-value">${summary.overallPercent}% genomfört</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= HERO BANNER: て-form Dojo (Alternativ 2 Layout + Mashup Light Warm Palette) ================= -->
    <section class="course-dojo-hero-banner" aria-label="Dagens fokus: て-form Dojo">
      <div class="dojo-hero-watermark" lang="ja" aria-hidden="true">て</div>

      <div class="dojo-hero-top">
        <div class="dojo-hero-copy">
          <div class="dojo-hero-badges">
            <span class="badge-dagens-fokus">DAGENS FOKUS</span>
            <span class="badge-sub">
              Genki I Lektion ${week.lessonNumber} · Verbkonjugation (${week.conjugations.length}
              verb)
            </span>
          </div>
          <h2>て-form Dojo — Böjningsregler & Snabbträning</h2>
          <p>
            Te-formen är nyckeln till att koppla ihop meningar, be om tillåtelse (〜てもいいですか)
            och uttrycka pågående handlingar (〜ています). Träna de fyra huvudsakliga
            böjningsmönstren steg för steg.
          </p>
        </div>

        <div class="dojo-hero-actions">
          <button
            type="button"
            class="course-btn-terracotta"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            ⚡ Starta て-form Dojo
          </button>
          <button
            type="button"
            class="course-btn-sage-outline"
            @click=${() => selectCourseSubView('grammar', host)}
          >
            📖 Grammatikförklaring
          </button>
        </div>
      </div>

      <!-- The 4 Conjugation Groups Grid inside the Hero Banner -->
      <div class="dojo-groups-section">
        <div class="dojo-groups-head">
          <span>DE 4 BÖJNINGSGRUPPERNA I LEKTION ${week.lessonNumber}</span>
          <button
            type="button"
            class="dojo-schema-link"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            Visa komplett böjningsschema →
          </button>
        </div>

        <div class="dojo-four-groups-grid">
          <!-- Group 1: Ru-verb -->
          <div class="dojo-group-card tone-mint">
            <div class="group-card-meta">
              <span>Ru-verb (る)</span>
              <span class="group-badge ok">✓ Grundregel</span>
            </div>
            <div class="group-card-jp" lang="ja">食べる <span class="arrow">➔</span> 食べて</div>
            <div class="group-card-romaji">taberu ➔ tabete ("att äta")</div>
            <div class="group-card-rule">
              Regel: Byt ut <strong>る</strong> direkt mot <strong>て</strong>
            </div>
          </div>

          <!-- Group 2: Undantag 行く -->
          <div class="dojo-group-card tone-terracotta">
            <div class="group-card-meta">
              <span>Undantag: 行く</span>
              <span class="group-badge warn">Varning</span>
            </div>
            <div class="group-card-jp" lang="ja">行く <span class="arrow warn">➔</span> 行って</div>
            <div class="group-card-romaji">iku ➔ itte ("att gå / åka")</div>
            <div class="group-card-rule">
              OBS! Blir <strong>ej iite</strong>. Dubbelkonsonant <strong>って</strong>!
            </div>
          </div>

          <!-- Group 3: U-verb -->
          <div class="dojo-group-card tone-sand">
            <div class="group-card-meta">
              <span>U-verb: む / ぶ / ぬ</span>
              <span class="group-badge neutral">Assimilation</span>
            </div>
            <div class="group-card-jp" lang="ja">飲む <span class="arrow">➔</span> 飲んで</div>
            <div class="group-card-romaji">nomu ➔ nonde ("att dricka")</div>
            <div class="group-card-rule">
              Regel: <strong>む / ぶ / ぬ</strong> blir tonande <strong>んで</strong>
            </div>
          </div>

          <!-- Group 4: Oregelbundna -->
          <div class="dojo-group-card tone-sage">
            <div class="group-card-meta">
              <span>Oregelbundna verb</span>
              <span class="group-badge ok">★ Centralt</span>
            </div>
            <div class="group-card-jp" lang="ja">する <span class="arrow">➔</span> して</div>
            <div class="group-card-romaji">suru ➔ shite / くる ➔ きて</div>
            <div class="group-card-rule">Måste memoreras utantill inför tentan.</div>
          </div>
        </div>
      </div>

      <!-- Example Sentence Callout Strip -->
      <div class="dojo-hero-example-strip">
        <div class="example-strip-left">
          <span class="example-bulb">💡</span>
          <div>
            <small>Exempelmening ur kapitlet (Mönster: Handling A + Handling B)</small>
            <strong lang="ja">「図書館に行って、本を借ります。」</strong>
            <span>Svenska: "Jag går till biblioteket och (sedan) lånar en bok."</span>
          </div>
        </div>
        <button
          type="button"
          class="dojo-example-btn"
          @click=${() => selectCourseSubView('grammar', host)}
        >
          Interaktiv grammatikförklaring →
        </button>
      </div>
    </section>

    <!-- ================= 3-COLUMN BENTO GRID: Veckans glosor, Kanji-kort, Veckotest ================= -->
    <section class="course-three-col-grid" aria-label="Veckans tre studiemoduler">
      <!-- COLUMN 1: VECKANS GLOSOR -->
      <article class="course-bento-card bento-vocab">
        <div>
          <div class="bento-col-header">
            <div class="bento-col-title">
              <span class="col-icon">🎴</span>
              <h2>Veckans glosor</h2>
            </div>
            <span class="bento-stat-pill">
              ${summary.vocabDone} / ${summary.vocabTotal} klara
            </span>
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
                              🔊 Lyssna på uttal
                            </button>
                          `
                        : ''
                    }
                  </div>
                `
              : ''
          }

          <div class="bento-queue-box">
            <span class="queue-heading">FLER NYCKELORD I VECKANS LISTA</span>
            <ul class="bento-queue-list">
              ${nextQueue.map(
                (item) => html`
                  <li>
                    <div class="q-left">
                      <strong lang="ja">${item.kanji || item.kana}</strong>
                      <span>${item.kana} · ${item.sv.split(';')[0]}</span>
                    </div>
                    <small>${item.category}</small>
                  </li>
                `,
              )}
            </ul>
          </div>
        </div>

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-primary full-width"
            @click=${() => selectCourseSubView('vocab', host)}
          >
            Öppna alla ${week.vocab.length} gloskort →
          </button>
        </div>
      </article>

      <!-- COLUMN 2: KANJI-KORT -->
      <article class="course-bento-card bento-kanji">
        <div>
          <div class="bento-col-header">
            <div class="bento-col-title">
              <span class="col-icon">🖌️</span>
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

          ${
            firstKanji
              ? html`
                  <div class="bento-mnemonic-box">
                    <strong
                      >💡 Mnemoteknik för ${firstKanji.kanji} (${firstKanji.meaningSv})</strong
                    >
                    <p>${firstKanji.mnemonicSv}</p>
                    ${
                      firstKanji.compounds[0]
                        ? html`
                            <div class="mnemonic-compound">
                              <span>Vanligt ord:</span>
                              <code lang="ja">
                                ${firstKanji.compounds[0].word} (${firstKanji.compounds[0].reading}
                                · ${firstKanji.compounds[0].sv})
                              </code>
                            </div>
                          `
                        : ''
                    }
                  </div>
                `
              : ''
          }
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
        <div>
          <div class="bento-col-header">
            <div class="bento-col-title">
              <span class="col-icon">🏁</span>
              <h2>Veckotest</h2>
            </div>
            <span class="bento-stat-pill terracotta-pill">
              Tentafokus · L${week.lessonNumber}
            </span>
          </div>

          <div class="bento-exam-summary">
            <div class="exam-summary-top">
              <span class="exam-tag">Diagnostiskt delprov</span>
              <span class="exam-time">⏱️ ${week.quiz.length} frågor</span>
            </div>
            <h3>Lektion ${week.lessonNumber} Veckokontroll</h3>
            <p>
              Testa om veckans glosor, verbböjningar, partiklar och läsförståelse sitter med direkt
              förklaring efter varje fråga.
            </p>

            <ul class="exam-breakdown-list">
              <li>
                <span>⚡ て-form & verbkonjugation</span>
                <strong>4 frågor</strong>
              </li>
              <li>
                <span>📐 Grammatik & partiklar</span>
                <strong>4 frågor</strong>
              </li>
              <li>
                <span>字 Ordförråd & Kanji</span>
                <strong>${Math.max(2, week.quiz.length - 8)} frågor</strong>
              </li>
            </ul>
          </div>

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

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-terracotta full-width"
            @click=${() => selectCourseSubView('quiz', host)}
          >
            ▶ Starta veckans minitest (${week.quiz.length} frågor)
          </button>
        </div>
      </article>
    </section>

    <!-- ================= COMPACT GRAMMAR QUICK-RULE SECTION (Alternativ 2 Bottom Reference) ================= -->
    <section class="course-grammar-quickref" aria-label="Veckans grammatiköversikt">
      <div class="quickref-header">
        <div>
          <span class="course-eyebrow">REFERENS · LATHUND INFÖR TENTA</span>
          <h2>Viktiga grammatikmönster i Genki Kapitel ${week.lessonNumber}</h2>
        </div>
        <button
          type="button"
          class="course-btn-secondary"
          @click=${() => selectCourseSubView('grammar', host)}
        >
          Öppna komplett grammatikguide (${week.grammar.length}) →
        </button>
      </div>

      <div class="quickref-grid">
        ${week.grammar.slice(0, 3).map(
          (g) => html`
            <div class="quickref-card">
              <div class="quickref-card-head">
                <span class="quickref-pill" lang="ja">${g.patternJp.split('｜')[0]}</span>
                <strong>${g.title}</strong>
              </div>
              <p>${g.summarySv}</p>
              ${
                g.examples[0]
                  ? html`
                      <div class="quickref-example" lang="ja">
                        <strong>${g.examples[0].jp}</strong>
                        <small>${g.examples[0].sv}</small>
                      </div>
                    `
                  : ''
              }
            </div>
          `,
        )}
      </div>
    </section>
  `;
}
