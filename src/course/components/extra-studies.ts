import { html } from 'lit-html';
import type { CourseHostContext, CourseTemplate } from '../types.ts';

interface AnkiSampleCard {
  id: string;
  front: string;
  frontSub?: string;
  back: string;
  reading: string;
  deck: string;
  note?: string;
}

const SAMPLE_ANKI_CARDS: AnkiSampleCard[] = [
  {
    id: 'anki-1',
    front: '食べる',
    frontSub: 'Genki I · Lektion 6 (Ru-verb)',
    reading: 'たべる',
    back: 'att äta (te-form: 食べて)',
    deck: 'Genki I: Kärnverb',
    note: 'Ru-verb: stammen behålls och る ersätts med て',
  },
  {
    id: 'anki-2',
    front: '結婚しています',
    frontSub: 'Genki I · Lektion 7 (Tillstånd)',
    reading: 'けっこんしています',
    back: 'är gift (beskriver ett kvarstående tillstånd)',
    deck: 'Genki I: Pågående handling & tillstånd',
    note: 'Te-form + います används för resulterande tillstånd som inträffade tidigare',
  },
  {
    id: 'anki-3',
    front: '〜と思います',
    frontSub: 'Genki I · Lektion 8 (Kortform)',
    reading: '〜とおもいます',
    back: 'jag tror / anser att ... (kräver kortform före と)',
    deck: 'Genki I: Åsikter & tankar',
    note: 'Exempel: 明日雨が降ると思います (Jag tror det kommer regna imorgon)',
  },
  {
    id: 'anki-4',
    front: '買った',
    frontSub: 'Genki I · Lektion 9 (た-form)',
    reading: 'かった',
    back: 'köpte (kortform dåtid av 買う)',
    deck: 'Genki I: Dåtid kortform',
    note: 'Följer samma böjningsmönster som te-formen: 買って → 買った',
  },
];

const RATING_LABELS: Record<string, string> = {
  again: 'Igen (< 1 min)',
  hard: 'Svårt (< 6 min)',
  good: 'Bra (< 10 min)',
  easy: 'Lätt (4 dagar)',
};

let activeCardIndex = 0;
let isFlipped = false;
let practiceCount = 0;
let lastRating: 'again' | 'hard' | 'good' | 'easy' | null = null;
let customDeckInput = '';
let showImportModal = false;

export function renderExtraStudiesModule(
  host: CourseHostContext,
  onBackToHub: () => void,
): CourseTemplate {
  const currentCard = SAMPLE_ANKI_CARDS[activeCardIndex % SAMPLE_ANKI_CARDS.length];

  const handleFlip = () => {
    isFlipped = !isFlipped;
    host.render();
  };

  const handleRate = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    lastRating = rating;
    practiceCount++;
    isFlipped = false;
    activeCardIndex = (activeCardIndex + 1) % SAMPLE_ANKI_CARDS.length;
    host.render();
  };

  const handleImportSubmit = (e: Event) => {
    e.preventDefault();
    if (customDeckInput.trim()) {
      host.announce('Kortlek förberedd för övning!');
      customDeckInput = '';
      showImportModal = false;
      host.render();
    }
  };

  return html`
    <section class="course-module-section extra-studies-section" aria-label="Extra studier och Anki-kortlekar">
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
          <span class="extra-studies-live-pill">
            <span class="mode-dot"></span>
            Anki & Repetition
          </span>
        </div>
      </div>

      <!-- Hero Header -->
      <header class="extra-studies-hero">
        <div class="course-breadcrumb-row">
          <div class="course-breadcrumbs">
            <span>Universitetskurs: Japanska I</span>
            <span class="sep">/</span>
            <strong class="crumb-current">Extra studier</strong>
            <span class="sep">/</span>
            <span>Anki-kortlekar & Fördjupning</span>
          </div>
          <div class="course-quick-pill-bar">
            <span class="course-badge-jp" lang="ja">追加学習</span>
            <span class="badge-dagens-fokus">ANKI-REDO</span>
          </div>
        </div>

        <h1 class="course-editorial-title">Extra studier · Anki & Kortlekar</h1>
        <p class="course-hero-desc">
          Här samlar vi extra studiematerial, repetition och framtida stöd för att träna egna
          Anki-kortlekar med Spaced Repetition (SRS) direkt i gränssnittet.
        </p>
      </header>

      <!-- Main Grid Layout -->
      <div class="extra-studies-grid">
        <!-- Interactive Anki Flashcard Practice Zone -->
        <article class="extra-card-deck-preview">
          <div class="extra-deck-head">
            <div>
              <span class="extra-eyebrow">INTERAKTIV REPETITION (SRS)</span>
              <h2>Öva Anki-kortlek</h2>
            </div>
            <div class="extra-deck-stats">
              <span class="bento-stat-pill">Kort ${activeCardIndex + 1} av ${SAMPLE_ANKI_CARDS.length}</span>
              ${practiceCount > 0 ? html`<span class="bento-stat-pill terracotta-pill">${practiceCount} repeterade</span>` : ''}
              ${lastRating ? html`<span class="bento-stat-pill success">${RATING_LABELS[lastRating]}</span>` : ''}
            </div>
          </div>

          <div
            class="anki-stage-card ${isFlipped ? 'flipped' : ''}"
            tabindex="0"
            role="button"
            aria-label=${isFlipped ? 'Kort baksida. Klicka för att vända tillbaka.' : 'Kort framsida. Klicka för att visa svar.'}
            @click=${handleFlip}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleFlip();
              }
            }}
          >
            <div class="anki-card-badge-row">
              <span class="anki-deck-chip">🎴 ${currentCard.deck}</span>
              ${host.tts ? html`
                <button
                  type="button"
                  class="mini-audio-btn"
                  title="Lyssna på uttal"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    host.speak(currentCard.reading, e.currentTarget as HTMLElement);
                  }}
                >
                  🔊 Lyssna
                </button>
              ` : ''}
            </div>

            <div class="anki-card-main-content" lang="ja">
              <small class="anki-reading">${currentCard.reading}</small>
              <strong class="anki-front-text">${currentCard.front}</strong>
              ${currentCard.frontSub ? html`<span class="anki-front-sub">${currentCard.frontSub}</span>` : ''}
            </div>

            ${isFlipped
              ? html`
                  <div class="anki-card-answer-revealed">
                    <hr class="anki-reveal-divider" />
                    <p class="anki-back-text">${currentCard.back}</p>
                    ${currentCard.note ? html`<small class="anki-note-text">💡 ${currentCard.note}</small>` : ''}
                  </div>
                `
              : html`
                  <div class="anki-card-prompt-hint">
                    <span>Tryck Mellanslag eller klicka för att visa svar</span>
                  </div>
                `}
          </div>

          <!-- Anki Rating Bar (Again, Hard, Good, Easy) -->
          <div class="anki-rating-tray" aria-label="Bedöm hur väl du mindes kortet">
            ${isFlipped
              ? html`
                  <button
                    type="button"
                    class="anki-rate-btn rate-again"
                    @click=${() => handleRate('again')}
                    title="Kom inte ihåg kortet"
                  >
                    <span class="rate-interval">&lt; 1 min</span>
                    <strong class="rate-label">Igen</strong>
                  </button>
                  <button
                    type="button"
                    class="anki-rate-btn rate-hard"
                    @click=${() => handleRate('hard')}
                    title="Svårt men mindes rätt"
                  >
                    <span class="rate-interval">&lt; 6 min</span>
                    <strong class="rate-label">Svårt</strong>
                  </button>
                  <button
                    type="button"
                    class="anki-rate-btn rate-good"
                    @click=${() => handleRate('good')}
                    title="Mindes bra utan tvekan"
                  >
                    <span class="rate-interval">&lt; 10 min</span>
                    <strong class="rate-label">Bra</strong>
                  </button>
                  <button
                    type="button"
                    class="anki-rate-btn rate-easy"
                    @click=${() => handleRate('easy')}
                    title="Satt direkt och enkelt"
                  >
                    <span class="rate-interval">4 dagar</span>
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
                `}
          </div>
        </article>

        <!-- Sidebar / Side Column: Decks & Import -->
        <aside class="extra-studies-sidebar-col">
          <!-- Planned & Available Decks -->
          <div class="extra-box-card">
            <div class="extra-box-header">
              <h3>Tillgängliga kortlekar</h3>
              <span class="extra-tag-pill">3 klara</span>
            </div>
            <ul class="anki-deck-list">
              <li class="anki-deck-item active">
                <div class="deck-item-icon">🎴</div>
                <div class="deck-item-info">
                  <strong>Genki I: Kärnverb & て-former</strong>
                  <small>Lektion 6–9 · 96 kort</small>
                </div>
                <span class="deck-status-dot active" title="Aktiv kortlek"></span>
              </li>
              <li class="anki-deck-item">
                <div class="deck-item-icon">📖</div>
                <div class="deck-item-info">
                  <strong>Delkurs 2 Glosor (Alla kapitel)</strong>
                  <small>284 gloskort med ljud & exempel</small>
                </div>
                <span class="deck-status-dot" title="Redo att aktivera"></span>
              </li>
              <li class="anki-deck-item">
                <div class="deck-item-icon">⛩️</div>
                <div class="deck-item-info">
                  <strong>Kanji & Streckordning</strong>
                  <small>64 tecken och sammansättningar</small>
                </div>
                <span class="deck-status-dot" title="Redo att aktivera"></span>
              </li>
            </ul>
          </div>

          <!-- Import / Add Decks Box -->
          <div class="extra-box-card import-card">
            <div class="extra-box-header">
              <h3>Importera Anki-kortlek</h3>
              <span class="extra-tag-pill future">Förberedd</span>
            </div>
            <p class="import-desc">
              Här kommer du kunna ladda upp <code>.apkg</code>-filer från Anki eller klistra in
              tabb-separerade kortlistor för anpassad studieträning.
            </p>
            <button
              type="button"
              class="course-btn-secondary full-width"
              @click=${() => {
                showImportModal = !showImportModal;
                host.render();
              }}
            >
              ${showImportModal ? 'Dölj importruta' : '➕ Klistra in egna kort'}
            </button>

            ${showImportModal
              ? html`
                  <form class="anki-import-form" @submit=${handleImportSubmit}>
                    <label for="anki-tsv-input" class="anki-input-label">
                      Klistra in kort (Framsida [Tab] Baksida):
                    </label>
                    <textarea
                      id="anki-tsv-input"
                      class="anki-textarea"
                      rows="3"
                      placeholder="食べる&#9;att äta&#10;飲む&#9;att dricka"
                      .value=${customDeckInput}
                      @input=${(e: Event) => {
                        customDeckInput = (e.target as HTMLTextAreaElement).value;
                      }}
                    ></textarea>
                    <button type="submit" class="course-btn-primary full-width" ?disabled=${!customDeckInput.trim()}>
                      Spara och förbered kortlek
                    </button>
                  </form>
                `
              : ''}
          </div>

          <!-- Quick Navigation to Practice Tools -->
          <div class="extra-box-card quick-links-card">
            <div class="extra-box-header">
              <h3>Fler träningsverktyg</h3>
            </div>
            <div class="extra-quick-links">
              <button
                type="button"
                class="extra-quick-link-btn"
                @click=${() => {
                  host.announce('Öppnar て-form Dojo');
                  const dojoBtn = document.querySelector('[data-course-nav="dojo"]') as HTMLButtonElement | null;
                  if (dojoBtn) dojoBtn.click();
                  else onBackToHub();
                }}
              >
                <span>🥋</span>
                <div>
                  <strong>て-form Dojo</strong>
                  <small>Snabbträna verbböjningar</small>
                </div>
                <span>→</span>
              </button>
              <button
                type="button"
                class="extra-quick-link-btn"
                @click=${() => {
                  host.announce('Öppnar Glosor');
                  const vocabBtn = document.querySelector('[data-course-nav="vocab"]') as HTMLButtonElement | null;
                  if (vocabBtn) vocabBtn.click();
                  else onBackToHub();
                }}
              >
                <span>🎴</span>
                <div>
                  <strong>Glosor med Apple Fluid fysik</strong>
                  <small>Svep och vänd ordkort</small>
                </div>
                <span>→</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;
}
