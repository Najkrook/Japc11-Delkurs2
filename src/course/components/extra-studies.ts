import { html } from 'lit-html';
import type { CourseHostContext, CourseTemplate } from '../types.ts';
import {
  TAE_KIM_ARCS,
  TAE_KIM_CARDS,
  extractShortMeaning,
  formatAnimeSource,
  getArcEndIndex,
  getArcStartIndex,
  searchTaeKimCards,
  type TaeKimArc,
  type TaeKimCard,
  type TaeKimSearchResult,
} from '../data/taeKimData.ts';
import { taeKimSrs, type TaeKimReviewRating } from '../tae-kim-srs.ts';

type ExtraStudiesViewMode = 'arcs' | 'study' | 'finished';

interface StudySession {
  title: string;
  subtitle: string;
  arcId?: string;
  mode: 'continuous' | 'weak' | 'custom';
  cardIndices: number[];
  currentIndex: number;
  isFlipped: boolean;
  reviewedCount: number;
  againCount: number;
  goodCount: number;
}

let viewMode: ExtraStudiesViewMode = 'arcs';
let activeSession: StudySession | null = null;
let searchQuery = '';
let searchResults: TaeKimSearchResult[] = [];
let currentAudioElement: HTMLAudioElement | null = null;
let isAudioPlaying = false;

function playCardAudio(card: TaeKimCard, host: CourseHostContext): void {
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement = null;
  }

  if (card.audio) {
    const audioPath = `/audio/${card.audio}`;
    const audio = new Audio(audioPath);
    currentAudioElement = audio;
    isAudioPlaying = true;
    host.render();

    audio.onended = () => {
      isAudioPlaying = false;
      host.render();
    };

    audio.onerror = () => {
      isAudioPlaying = false;
      if (host.tts) {
        host.speak(card.hiragana || card.kanji);
      }
      host.render();
    };

    audio.play().catch(() => {
      isAudioPlaying = false;
      if (host.tts) {
        host.speak(card.hiragana || card.kanji);
      }
      host.render();
    });
  } else if (host.tts) {
    host.speak(card.hiragana || card.kanji);
  }
}

function startArcContinuousSession(
  arc: TaeKimArc,
  host: CourseHostContext,
  resetToStart: boolean = false,
): void {
  if (resetToStart) {
    taeKimSrs.resetArcPosition(arc.id);
  }

  const savedPos = resetToStart ? 0 : taeKimSrs.getArcPosition(arc.id);
  const pos = savedPos >= arc.totalCards ? 0 : savedPos;
  if (savedPos >= arc.totalCards && !resetToStart) {
    taeKimSrs.resetArcPosition(arc.id);
  }

  const startIdx = getArcStartIndex(arc);
  const endIdx = getArcEndIndex(arc);
  const indices: number[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    indices.push(i);
  }

  activeSession = {
    title: arc.titleSv,
    subtitle: `Arc ${arc.arcNumber} · Kontinuerlig läsning`,
    arcId: arc.id,
    mode: 'continuous',
    cardIndices: indices,
    currentIndex: pos,
    isFlipped: false,
    reviewedCount: 0,
    againCount: 0,
    goodCount: 0,
  };

  viewMode = 'study';
  host.render();

  const currentCardIndex = indices[pos];
  const firstCard = TAE_KIM_CARDS[currentCardIndex];
  if (firstCard && taeKimSrs.getState().autoPlayAudio) {
    setTimeout(() => playCardAudio(firstCard, host), 150);
  }
}

function startArcWeakSession(arc: TaeKimArc, host: CourseHostContext): void {
  const indices = taeKimSrs.getArcWeakCardIndices(arc.id);
  if (indices.length === 0) return;

  activeSession = {
    title: `${arc.titleSv} · Svaga kort`,
    subtitle: `Arc ${arc.arcNumber} · ${indices.length} problemkort`,
    arcId: arc.id,
    mode: 'weak',
    cardIndices: indices,
    currentIndex: 0,
    isFlipped: false,
    reviewedCount: 0,
    againCount: 0,
    goodCount: 0,
  };

  viewMode = 'study';
  host.render();

  const currentCardIndex = indices[0];
  const firstCard = TAE_KIM_CARDS[currentCardIndex];
  if (firstCard && taeKimSrs.getState().autoPlayAudio) {
    setTimeout(() => playCardAudio(firstCard, host), 150);
  }
}

function startCustomSession(
  title: string,
  subtitle: string,
  indices: number[],
  host: CourseHostContext,
  arcId?: string,
): void {
  if (indices.length === 0) return;

  activeSession = {
    title,
    subtitle,
    arcId,
    mode: 'custom',
    cardIndices: indices,
    currentIndex: 0,
    isFlipped: false,
    reviewedCount: 0,
    againCount: 0,
    goodCount: 0,
  };

  viewMode = 'study';
  host.render();

  const firstCardIndex = indices[0];
  const firstCard = TAE_KIM_CARDS[firstCardIndex];
  if (firstCard && taeKimSrs.getState().autoPlayAudio) {
    setTimeout(() => playCardAudio(firstCard, host), 150);
  }
}

// Global keyboard listeners for Space, Enter, 1-4, R, S, Esc
if (
  typeof window !== 'undefined' &&
  !(window as unknown as { __taeKimKeyboardAttached?: boolean }).__taeKimKeyboardAttached
) {
  (window as unknown as { __taeKimKeyboardAttached?: boolean }).__taeKimKeyboardAttached = true;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (viewMode !== 'study' || !activeSession) return;

    // Ignore keypresses if typing in an input
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const flipBtn = document.querySelector('.taekim-card-stage') as HTMLElement | null;
      if (flipBtn) flipBtn.click();
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const audioBtn = document.querySelector('.anki-audio-play-btn') as HTMLElement | null;
      if (audioBtn) audioBtn.click();
      return;
    }

    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      const starBtn = document.querySelector('.anki-star-toggle-btn') as HTMLElement | null;
      if (starBtn) starBtn.click();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      const backBtn = document.querySelector('.anki-back-nav-btn') as HTMLElement | null;
      if (backBtn) backBtn.click();
      return;
    }

    if (activeSession.isFlipped) {
      if (e.key === '1') {
        e.preventDefault();
        const btn = document.querySelector('.anki-rate-btn.rate-again') as HTMLElement | null;
        if (btn) btn.click();
      } else if (e.key === '2') {
        e.preventDefault();
        const btn = document.querySelector('.anki-rate-btn.rate-hard') as HTMLElement | null;
        if (btn) btn.click();
      } else if (e.key === '3') {
        e.preventDefault();
        const btn = document.querySelector('.anki-rate-btn.rate-good') as HTMLElement | null;
        if (btn) btn.click();
      } else if (e.key === '4') {
        e.preventDefault();
        const btn = document.querySelector('.anki-rate-btn.rate-easy') as HTMLElement | null;
        if (btn) btn.click();
      }
    }
  });
}

export function renderExtraStudiesModule(
  host: CourseHostContext,
  onBackToHub: () => void,
): CourseTemplate {
  if (viewMode === 'study' && activeSession) {
    return renderStudyScreen(host);
  }

  if (viewMode === 'finished' && activeSession) {
    return renderFinishedScreen(host);
  }

  return renderArcsOverview(host, onBackToHub);
}

function renderArcsOverview(host: CourseHostContext, onBackToHub: () => void): CourseTemplate {
  const overallStats = taeKimSrs.getOverallStats();
  const dueIndices = taeKimSrs.getDueCardIndices();
  const autoPlay = taeKimSrs.getState().autoPlayAudio;

  const handleSearchInput = (e: Event) => {
    searchQuery = (e.target as HTMLInputElement).value;
    searchResults = searchTaeKimCards(searchQuery);
    host.render();
  };

  return html`
    <section
      class="course-module-section taekim-section"
      aria-label="Tae Kim Anime Immersion Extra Studier"
    >
      <!-- Top Navigation & Return -->
      <div class="course-module-topbar">
        <button
          type="button"
          class="course-back-btn"
          @click=${onBackToHub}
          title="Gå tillbaka till den vanliga studieplanen"
        >
          ← Tillbaka till studieplanen
        </button>
        <div class="course-module-controls">
          <button
            type="button"
            class="taekim-autoplay-toggle ${autoPlay ? 'active' : ''}"
            @click=${() => {
              taeKimSrs.toggleAutoPlay();
              host.render();
            }}
            title="Spela upp uttal automatiskt när ett kort visas"
          >
            <span>${autoPlay ? '🔊 Autoplay På' : '🔈 Autoplay Av'}</span>
          </button>
        </div>
      </div>

      <!-- Hero Header -->
      <header class="taekim-hero">
        <div class="course-breadcrumb-row">
          <div class="course-breadcrumbs">
            <span>Universitetskurs: Japanska I</span>
            <span class="sep">/</span>
            <strong class="crumb-current">Extra studier</strong>
            <span class="sep">/</span>
            <span>Tae Kim Anime Immersion</span>
          </div>
          <div class="course-quick-pill-bar">
            <span class="course-badge-jp" lang="ja">アニメイマージョン</span>
            <span class="badge-dagens-fokus">2 075 KORT · 6 ARCS</span>
          </div>
        </div>

        <h1 class="course-editorial-title">Extra studier · Tae Kim Anime Immersion</h1>
        <p class="course-hero-desc">
          2 075 autentiska meningar och glosor från anime, indelade i 6 stora Arcs efter Tae Kims
          grammatiska ordning. Hoppa in och ut när du vill – din position sparas automatiskt på
          varje kort, och kort du har svårt för samlas i en egen övningshög för varje Arc.
        </p>

        <!-- Overall SRS Stats Strip -->
        <div class="course-stats-bar taekim-stats-bar">
          <div class="course-stat-cell">
            <div class="stat-meta">
              <span class="stat-label">Repeterade kort totalt</span>
              <strong class="stat-value">
                ${overallStats.totalReviewed} <span class="stat-denom">/ 2 075</span>
              </strong>
            </div>
            <div class="stat-bar-track">
              <div
                class="stat-bar-fill"
                style="width: ${Math.round((overallStats.totalReviewed / 2075) * 100)}%"
              ></div>
            </div>
          </div>

          <div class="course-stat-cell">
            <div class="stat-meta">
              <span class="stat-label">Bemästrade kort (&gt;21d)</span>
              <strong class="stat-value ring-value">${overallStats.totalMastered}</strong>
            </div>
            <div class="stat-bar-track">
              <div
                class="stat-bar-fill success"
                style="width: ${Math.round((overallStats.totalMastered / 2075) * 100)}%"
              ></div>
            </div>
          </div>

          <div class="course-stat-cell">
            <div class="stat-meta">
              <span class="stat-label">Sparade favoriter</span>
              <strong class="stat-value">${overallStats.bookmarkedCount}</strong>
            </div>
            <div class="stat-bar-track">
              <div
                class="stat-bar-fill accent"
                style="width: ${Math.min(100, overallStats.bookmarkedCount * 5)}%"
              ></div>
            </div>
          </div>
        </div>

        <!-- Quick Launch Action Strip (Due cards & Bookmarks) -->
        <div class="taekim-quick-actions">
          ${
            dueIndices.length > 0
              ? html`
                  <button
                    type="button"
                    class="course-btn-mistakes"
                    @click=${() =>
                      startCustomSession(
                        'Dagens Repetition',
                        `${dueIndices.length} förfallna kort i SM-2`,
                        dueIndices,
                        host,
                      )}
                  >
                    ⚡ Repetera förfallna kort (${dueIndices.length}) →
                  </button>
                `
              : html`
                  <span class="taekim-due-clear-badge">
                    ✓ Inga förfallna kort idag! Välj en Arc nedan för att fortsätta studera.
                  </span>
                `
          }
          ${
            overallStats.bookmarkedCount > 0
              ? html`
                  <button
                    type="button"
                    class="taekim-star-filter-btn"
                    @click=${() => {
                      const saved = Object.keys(taeKimSrs.getState().bookmarks).map(Number);
                      startCustomSession(
                        'Mina Sparade Favoriter',
                        `${saved.length} stjärnmärkta kort`,
                        saved,
                        host,
                      );
                    }}
                  >
                    ⭐ Sparade favoriter (${overallStats.bookmarkedCount})
                  </button>
                `
              : ''
          }
        </div>
      </header>

      <!-- Live Search Bar -->
      <div class="taekim-search-box">
        <label for="taekim-search-input" class="taekim-search-label">
          🔍 Sök bland alla 2 075 kort (Romaji, Kanji, Hiragana, Betydelse eller Anime):
        </label>
        <input
          id="taekim-search-input"
          type="search"
          class="taekim-search-input"
          placeholder="T.ex. taberu, 結婚, AnoHana, desu, 食べる..."
          .value=${searchQuery}
          @input=${handleSearchInput}
        />

        ${
          searchQuery.trim() && searchResults.length > 0
            ? html`
                <div class="taekim-search-results">
                  <span class="search-count">${searchResults.length} träffar:</span>
                  <div class="search-results-list">
                    ${searchResults.map((res) => {
                      const arc =
                        TAE_KIM_ARCS.find(
                          (a) =>
                            res.globalIndex >= getArcStartIndex(a) &&
                            res.globalIndex < getArcEndIndex(a),
                        ) || TAE_KIM_ARCS[0];
                      const arcOffset = res.globalIndex - getArcStartIndex(arc);

                      return html`
                        <div class="search-result-row">
                          <div class="search-result-main" lang="ja">
                            <strong>${res.card.kanji || res.card.hiragana}</strong>
                            <small>${res.card.hiragana} · ${res.card.romaji}</small>
                            <span class="search-def">${extractShortMeaning(res.card.meaning)}</span>
                          </div>
                          <div class="search-result-side">
                            <span class="search-source-tag"
                              >${formatAnimeSource(res.card.source)}</span
                            >
                            <span class="arc-search-badge" style="color: ${arc.accentColor}">
                              Arc ${arc.arcNumber} · Kort ${arcOffset + 1}
                            </span>
                            <button
                              type="button"
                              class="course-btn-primary search-open-btn"
                              @click=${() => {
                                taeKimSrs.setArcPosition(arc.id, arcOffset);
                                startArcContinuousSession(arc, host);
                              }}
                            >
                              Hoppa hit i Arc ${arc.arcNumber} →
                            </button>
                          </div>
                        </div>
                      `;
                    })}
                  </div>
                </div>
              `
            : searchQuery.trim()
              ? html`<p class="search-empty">Inga kort matchade "${searchQuery}".</p>`
              : ''
        }
      </div>

      <!-- 6 Arcs Container (Continuous Flow Cards) -->
      <div class="taekim-arcs-container">
        <div class="taekim-arcs-header">
          <div>
            <h2>Välj Arc att studera</h2>
            <p class="taekim-arcs-subtitle">
              Varje Arc är ett sammanhängande kapitel. Tryck "Fortsätt" för att hoppa rakt in där du
              avslutade, eller öva på korten du haft svårt för.
            </p>
          </div>
          <span class="taekim-arc-count-pill">6 Stora Arcs · 2 075 Kort</span>
        </div>

        <div class="taekim-arcs-grid">
          ${TAE_KIM_ARCS.map((arc) => {
            const stats = taeKimSrs.getArcStats(arc);
            const isFinished = stats.currentPosition >= arc.totalCards;
            const hasStarted = stats.currentPosition > 0;
            const weakCount = stats.weakCount;

            return html`
              <article
                class="taekim-arc-card ${isFinished ? 'arc-completed' : ''}"
                style="--arc-color: ${arc.accentColor}; --arc-bg: ${arc.badgeBg};"
              >
                <!-- Arc Header -->
                <div class="arc-card-top">
                  <div class="arc-badge-group">
                    <span class="arc-emoji">${arc.iconEmoji}</span>
                    <span class="arc-badge">Arc ${arc.arcNumber}</span>
                  </div>
                  <span class="arc-total-cards">${arc.totalCards} kort</span>
                </div>

                <div class="arc-card-titles">
                  <strong class="arc-title"
                    >${arc.titleSv.split(':')[1]?.trim() || arc.titleSv}</strong
                  >
                  <div class="arc-subtitles" lang="ja">
                    <span class="arc-jap-title">${arc.titleJap}</span>
                    <span class="arc-romaji-title">· ${arc.romajiTitle}</span>
                  </div>
                </div>

                <p class="arc-desc">${arc.descriptionSv}</p>

                <!-- Progress & Stats Indicators -->
                <div class="arc-progress-section">
                  <div class="arc-progress-meta">
                    <span class="arc-progress-label">
                      ${
                        hasStarted
                          ? html`Kort <strong>${stats.currentPosition}</strong> av ${arc.totalCards}`
                          : html`Ej påbörjad`
                      }
                    </span>
                    <span class="arc-progress-pct">${stats.progressPercent}%</span>
                  </div>

                  <div class="arc-progress-bar">
                    <span
                      style="width: ${stats.progressPercent}%; background: ${arc.accentColor}"
                    ></span>
                  </div>

                  <div class="arc-stats-pills">
                    ${
                      stats.masteredCards > 0
                        ? html`
                            <span
                              class="arc-pill mastered"
                              title="Kort med SM-2 intervall >= 21 dagar"
                            >
                              ✓ ${stats.masteredCards} bemästrade
                            </span>
                          `
                        : ''
                    }
                    ${
                      weakCount > 0
                        ? html`
                            <span
                              class="arc-pill weak"
                              title="Kort du har haft svårt för i denna Arc"
                            >
                              ⚠️ ${weakCount} svaga kort
                            </span>
                          `
                        : ''
                    }
                  </div>
                </div>

                <!-- Arc Action Buttons -->
                <div class="taekim-arc-actions">
                  ${
                    !hasStarted
                      ? html`
                          <button
                            type="button"
                            class="course-btn-primary taekim-resume-btn"
                            data-arc-action="start-resume"
                            @click=${() => startArcContinuousSession(arc, host)}
                          >
                            ▶ Starta Arc ${arc.arcNumber}
                          </button>
                        `
                      : isFinished
                        ? html`
                            <button
                              type="button"
                              class="course-btn-primary taekim-resume-btn completed"
                              data-arc-action="start-resume"
                              @click=${() => startArcContinuousSession(arc, host, true)}
                            >
                              ↺ Repetera Arc ${arc.arcNumber}
                            </button>
                          `
                        : html`
                            <button
                              type="button"
                              class="course-btn-primary taekim-resume-btn"
                              data-arc-action="start-resume"
                              @click=${() => startArcContinuousSession(arc, host)}
                            >
                              ▶ Fortsätt från kort ${stats.currentPosition + 1}
                            </button>
                          `
                  }
                  ${
                    weakCount > 0
                      ? html`
                          <button
                            type="button"
                            class="course-btn-mistakes secondary taekim-weak-btn"
                            data-arc-action="weak-cards"
                            @click=${() => startArcWeakSession(arc, host)}
                            title="Öva enbart på de ${weakCount} kort du svarat Igen eller Svårt på i Arc ${arc.arcNumber}"
                          >
                            ⚠️ Öva svaga kort (${weakCount})
                          </button>
                        `
                      : ''
                  }
                  ${
                    hasStarted
                      ? html`
                          <button
                            type="button"
                            class="taekim-reset-btn"
                            data-arc-action="reset"
                            @click=${() => {
                              if (confirm(`Vill du börja om Arc ${arc.arcNumber} från kort 1?`)) {
                                taeKimSrs.resetArcPosition(arc.id);
                                host.render();
                              }
                            }}
                            title="Återställ positionen till kort 1"
                          >
                            ↺ Börja om
                          </button>
                        `
                      : ''
                  }
                </div>
              </article>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

function renderStudyScreen(host: CourseHostContext): CourseTemplate {
  if (!activeSession) return html``;

  const { cardIndices, currentIndex, isFlipped, title, subtitle, arcId, mode } = activeSession;
  const currentCardIndex = cardIndices[currentIndex % cardIndices.length];
  const card = TAE_KIM_CARDS[currentCardIndex];

  if (!card) {
    return html`
      <div class="course-empty-card">
        <h2>Kunde inte ladda kort.</h2>
        <button
          class="course-btn-primary"
          @click=${() => {
            viewMode = 'arcs';
            host.render();
          }}
        >
          Tillbaka
        </button>
      </div>
    `;
  }

  const isBookmarked = taeKimSrs.isBookmarked(currentCardIndex);
  const cardProgress = taeKimSrs.getCardProgress(currentCardIndex);
  const intervals = taeKimSrs.calculateNextIntervals(cardProgress);
  const autoPlay = taeKimSrs.getState().autoPlayAudio;

  const handleFlip = () => {
    activeSession!.isFlipped = !activeSession!.isFlipped;
    host.render();
  };

  const handleRate = (rating: TaeKimReviewRating) => {
    if (!activeSession) return;

    // Review card with SM-2, linking to arcId if present
    taeKimSrs.reviewCard(currentCardIndex, rating, arcId);
    activeSession.reviewedCount++;
    if (rating === 'again') activeSession.againCount++;
    if (rating === 'good' || rating === 'easy') activeSession.goodCount++;

    // In continuous mode, advance and persist the Arc position immediately
    if (mode === 'continuous' && arcId) {
      taeKimSrs.setArcPosition(arcId, currentIndex + 1);
    }

    // Check if session completed
    if (currentIndex + 1 >= cardIndices.length) {
      viewMode = 'finished';
      host.render();
      return;
    }

    activeSession.currentIndex++;
    activeSession.isFlipped = false;
    host.render();

    const nextIndex = cardIndices[activeSession.currentIndex];
    const nextCard = TAE_KIM_CARDS[nextIndex];
    if (nextCard && taeKimSrs.getState().autoPlayAudio) {
      setTimeout(() => playCardAudio(nextCard, host), 150);
    }
  };

  const handleBookmark = (e: Event) => {
    e.stopPropagation();
    taeKimSrs.toggleBookmark(currentCardIndex);
    host.render();
  };

  const progressPct = Math.round(((currentIndex + 1) / cardIndices.length) * 100);

  return html`
    <section class="course-module-section taekim-study-section" aria-label="Tae Kim Kortleksövning">
      <!-- Top Study Control Bar -->
      <div class="course-module-topbar">
        <button
          type="button"
          class="course-back-btn anki-back-nav-btn"
          @click=${() => {
            if (currentAudioElement) currentAudioElement.pause();
            viewMode = 'arcs';
            host.render();
          }}
          title="Avsluta och återgå till Arc-översikten (Esc)"
        >
          ← Tillbaka till Arcs
        </button>

        <div class="taekim-study-meta">
          <strong>${title}</strong>
          <small>${subtitle} · Kort ${currentIndex + 1} av ${cardIndices.length}</small>
        </div>

        <div class="course-module-controls">
          <button
            type="button"
            class="taekim-star-btn anki-star-toggle-btn ${isBookmarked ? 'active' : ''}"
            @click=${handleBookmark}
            title="Spara/ta bort favorit (Tangent S)"
          >
            ${isBookmarked ? '★ Sparat' : '☆ Spara'}
          </button>

          <button
            type="button"
            class="taekim-autoplay-toggle ${autoPlay ? 'active' : ''}"
            @click=${() => {
              taeKimSrs.toggleAutoPlay();
              host.render();
            }}
            title="Spela upp uttal automatiskt"
          >
            <span>${autoPlay ? '🔊 Autoplay' : '🔈 Tyst'}</span>
          </button>
        </div>
      </div>

      <!-- Linear Session Progress Bar -->
      <div class="taekim-linear-progress">
        <div class="taekim-linear-fill" style="width: ${progressPct}%"></div>
      </div>

      <!-- Flashcard Interactive Stage -->
      <article
        class="anki-stage-card taekim-card-stage ${isFlipped ? 'flipped' : ''}"
        tabindex="0"
        role="button"
        aria-label=${
          isFlipped
            ? 'Kort baksida. Klicka för att vända tillbaka.'
            : 'Kort framsida. Klicka för att visa svar.'
        }
        @click=${handleFlip}
      >
        <!-- Card Header Badges -->
        <div class="anki-card-badge-row">
          <span class="search-source-tag">🎬 ${formatAnimeSource(card.source)}</span>
          <div class="stage-right-badges">
            ${
              cardProgress?.status
                ? html`<span class="anki-status-tag ${cardProgress.status}"
                    >${cardProgress.status.toUpperCase()}</span
                  >`
                : html`<span class="anki-status-tag new">NYTT</span>`
            }
            <button
              type="button"
              class="mini-audio-btn anki-audio-play-btn ${isAudioPlaying ? 'playing' : ''}"
              title="Lyssna på anime-ljudet (Tangent R)"
              @click=${(e: Event) => {
                e.stopPropagation();
                playCardAudio(card, host);
              }}
            >
              ${isAudioPlaying ? '🔊 Spelar...' : '🔊 Ljud (R)'}
            </button>
          </div>
        </div>

        <!-- Front Side Content -->
        <div class="anki-card-main-content" lang="ja">
          <small class="anki-reading">${card.hiragana || card.romaji}</small>
          <strong class="anki-front-text">${card.kanji || card.hiragana}</strong>
          <span class="anki-front-sub">${card.romaji}</span>
        </div>

        <!-- Back Side Content (revealed on flip) -->
        ${
          isFlipped
            ? html`
                <div class="anki-card-answer-revealed">
                  <hr class="anki-reveal-divider" />

                  <!-- Anime Image Screenshot if available -->
                  ${
                    card.image
                      ? html`
                          <div class="taekim-image-wrapper">
                            <img
                              class="taekim-screenshot"
                              src="/images/anki/${card.image}"
                              alt="${formatAnimeSource(card.source)}"
                              loading="eager"
                            />
                          </div>
                        `
                      : ''
                  }

                  <!-- English Definition & Tae Kim Explanation -->
                  <div class="taekim-meaning-box">
                    <h4 class="taekim-def-title">${extractShortMeaning(card.meaning)}</h4>
                    <p class="taekim-full-meaning">${card.meaning}</p>
                  </div>
                </div>
              `
            : html`
                <div class="anki-card-prompt-hint">
                  <span
                    >Tryck <strong>Mellanslag</strong> eller klicka för att visa svar och
                    anime-bild</span
                  >
                </div>
              `
        }
      </article>

      <!-- Rating Tray (when flipped) or Show Answer CTA (when front) -->
      <div class="anki-rating-tray" aria-label="Bedöm ditt minne med SuperMemo SM-2">
        ${
          isFlipped
            ? html`
                <button
                  type="button"
                  class="anki-rate-btn rate-again"
                  @click=${() => handleRate('again')}
                  title="Kom inte ihåg (Tangent 1)"
                >
                  <span class="rate-key-hint">[1]</span>
                  <span class="rate-interval">${intervals.again.label}</span>
                  <strong class="rate-label">Igen</strong>
                </button>

                <button
                  type="button"
                  class="anki-rate-btn rate-hard"
                  @click=${() => handleRate('hard')}
                  title="Svårt men mindes (Tangent 2)"
                >
                  <span class="rate-key-hint">[2]</span>
                  <span class="rate-interval">${intervals.hard.label}</span>
                  <strong class="rate-label">Svårt</strong>
                </button>

                <button
                  type="button"
                  class="anki-rate-btn rate-good"
                  @click=${() => handleRate('good')}
                  title="Mindes bra (Tangent 3)"
                >
                  <span class="rate-key-hint">[3]</span>
                  <span class="rate-interval">${intervals.good.label}</span>
                  <strong class="rate-label">Bra</strong>
                </button>

                <button
                  type="button"
                  class="anki-rate-btn rate-easy"
                  @click=${() => handleRate('easy')}
                  title="Satt direkt (Tangent 4)"
                >
                  <span class="rate-key-hint">[4]</span>
                  <span class="rate-interval">${intervals.easy.label}</span>
                  <strong class="rate-label">Lätt</strong>
                </button>
              `
            : html`
                <button
                  type="button"
                  class="course-btn-primary anki-show-answer-btn"
                  @click=${handleFlip}
                >
                  Visa svar (Mellanslag) →
                </button>
              `
        }
      </div>
    </section>
  `;
}

function renderFinishedScreen(host: CourseHostContext): CourseTemplate {
  if (!activeSession) return html``;

  const { title, reviewedCount, againCount, goodCount, arcId, mode } = activeSession;
  const currentArc = arcId ? TAE_KIM_ARCS.find((a) => a.id === arcId) : undefined;
  const nextArc = currentArc
    ? TAE_KIM_ARCS.find((a) => a.arcNumber === currentArc.arcNumber + 1)
    : undefined;
  const weakCount = currentArc ? taeKimSrs.getArcWeakCardIndices(currentArc.id).length : 0;
  const currentPos = currentArc ? taeKimSrs.getArcPosition(currentArc.id) : 0;

  if (mode === 'weak') {
    return html`
      <section
        class="course-module-section taekim-finished-section"
        aria-label="Svaga kort session slutförd"
      >
        <div class="taekim-finished-card">
          <span class="course-eyebrow"
            >SVAGA KORT · ${currentArc?.titleSv.toUpperCase() || 'TAE KIM ANKI'}</span
          >
          ${
            weakCount === 0
              ? html`
                  <h1>🌟 Alla problemkort bemästrade!</h1>
                  <p class="taekim-finished-sub">
                    Fantastiskt! Du har klarat alla tidigare svaga kort i denna Arc och de har
                    graderats ut ur svaghetskortleken.
                  </p>
                `
              : html`
                  <h1>💪 Bra övningspass!</h1>
                  <p class="taekim-finished-sub">
                    Du repeterade ${reviewedCount} kort. Det finns ${weakCount} kort kvar i denna
                    Arcs svaghetshög.
                  </p>
                `
          }

          <div class="taekim-finished-metrics">
            <div class="finished-stat">
              <strong>${reviewedCount}</strong>
              <span>Övade kort</span>
            </div>
            <div class="finished-stat success">
              <strong>${goodCount}</strong>
              <span>Klarade (Bra/Lätt)</span>
            </div>
            ${
              weakCount > 0
                ? html`
                    <div class="finished-stat warning">
                      <strong>${weakCount}</strong>
                      <span>Kvar att repetera</span>
                    </div>
                  `
                : ''
            }
          </div>

          <div class="taekim-finished-actions">
            ${
              weakCount > 0 && currentArc
                ? html`
                    <button
                      type="button"
                      class="course-btn-mistakes secondary"
                      @click=${() => startArcWeakSession(currentArc, host)}
                    >
                      ⚠️ Öva de ${weakCount} kvarvarande svaga korten →
                    </button>
                  `
                : ''
            }
            ${
              currentArc && currentPos < currentArc.totalCards
                ? html`
                    <button
                      type="button"
                      class="course-btn-primary"
                      @click=${() => startArcContinuousSession(currentArc, host)}
                    >
                      ▶ Fortsätt Arc ${currentArc.arcNumber} från kort ${currentPos + 1} →
                    </button>
                  `
                : ''
            }

            <button
              type="button"
              class="course-btn-secondary"
              @click=${() => {
                viewMode = 'arcs';
                host.render();
              }}
            >
              Tillbaka till Arcs-översikten
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // Continuous or Custom mode
  return html`
    <section class="course-module-section taekim-finished-section" aria-label="Session slutförd">
      <div class="taekim-finished-card">
        <span class="course-eyebrow">PASS AVKLARAT · TAE KIM ANKI</span>
        <h1>🎉 Strålande jobbat!</h1>
        <p class="taekim-finished-sub">
          ${title} är färdigrepeterat och uppdaterat i din SM-2 glömskekurva.
        </p>

        <div class="taekim-finished-metrics">
          <div class="finished-stat">
            <strong>${reviewedCount}</strong>
            <span>Kort repeterade</span>
          </div>
          <div class="finished-stat success">
            <strong>${goodCount}</strong>
            <span>Bra / Lätta svar</span>
          </div>
          ${
            againCount > 0
              ? html`
                  <div class="finished-stat warning">
                    <strong>${againCount}</strong>
                    <span>Tillagda i svaghetshög</span>
                  </div>
                `
              : ''
          }
        </div>

        <div class="taekim-finished-actions">
          ${
            weakCount > 0 && currentArc
              ? html`
                  <button
                    type="button"
                    class="course-btn-mistakes secondary"
                    @click=${() => startArcWeakSession(currentArc, host)}
                  >
                    ⚠️ Öva de ${weakCount} svaga korten nu →
                  </button>
                `
              : ''
          }
          ${
            nextArc
              ? html`
                  <button
                    type="button"
                    class="course-btn-primary"
                    @click=${() => startArcContinuousSession(nextArc, host)}
                  >
                    Starta nästa Arc (Arc ${nextArc.arcNumber}) →
                  </button>
                `
              : ''
          }
          ${
            currentArc
              ? html`
                  <button
                    type="button"
                    class="course-btn-secondary"
                    @click=${() => startArcContinuousSession(currentArc, host, true)}
                  >
                    ↺ Börja om Arc ${currentArc.arcNumber} från kort 1
                  </button>
                `
              : ''
          }

          <button
            type="button"
            class="course-btn-secondary"
            @click=${() => {
              viewMode = 'arcs';
              host.render();
            }}
          >
            Tillbaka till Arcs-översikten
          </button>
        </div>
      </div>
    </section>
  `;
}
