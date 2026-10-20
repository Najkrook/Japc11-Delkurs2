import { html } from 'lit-html';
import type {
  CourseHostContext,
  CourseProgressData,
  CourseTemplate,
  CourseWeek,
} from '../types.ts';
import type { UpdateCourseProgress } from '../course-progress.ts';
import { studyDrills } from '../study-drills.ts';
import { bindSwipeableFlashcard } from '../apple-physics.ts';

let vocabMode: 'cards' | 'list' = 'cards';
const vocabDrill = studyDrills.vocab;

const CATEGORY_LABELS: Record<string, string> = {
  'verb-u': 'U-verb',
  'verb-ru': 'Ru-verb',
  'verb-irr': 'Oregelbundet verb',
  adjective: 'Adjektiv',
  noun: 'Substantiv',
  expression: 'Uttryck / Adverb',
};

export function renderVocabModule(
  week: CourseWeek,
  progress: CourseProgressData,
  host: CourseHostContext,
  updateProgress: UpdateCourseProgress,
  onBackToHub: () => void,
): CourseTemplate {
  const state = vocabDrill.read(week, progress);
  const { items, current, index: safeIdx, masteredCount } = state;

  const markAndAdvance = (mastered: boolean) => {
    const command = vocabDrill.markAndAdvance(mastered);
    if (command) updateProgress(command);
    host.render();
  };

  return html`
    <section class="course-module-section" aria-label="Veckans glosor">
      <div class="course-module-topbar">
        <button class="course-back-btn" @click=${onBackToHub}>
          ← Tillbaka till ${week.titleSv.split(':')[0]}
        </button>
        <div class="course-module-controls">
          <div class="course-pill-switch" role="group" aria-label="Visningsläge för glosor">
            <button
              type="button"
              class=${vocabMode === 'cards' ? 'active' : ''}
              @click=${() => {
                vocabMode = 'cards';
                host.render();
              }}
            >
              Flashcards
            </button>
            <button
              type="button"
              class=${vocabMode === 'list' ? 'active' : ''}
              @click=${() => {
                vocabMode = 'list';
                host.render();
              }}
            >
              Hela ordlistan (${week.vocab.length})
            </button>
          </div>
        </div>
      </div>

      <div class="dojo-header-banner">
        <div>
          <span class="course-eyebrow">LEKTION ${week.lessonNumber} · ORDFÖRRÅD</span>
          <h1>Veckans glosor (${week.vocab.length} ord)</h1>
          <p>Vänd korten, lyssna på uttalet och bocka av de ord som sitter.</p>
        </div>
        <div class="dojo-score-pill">
          <strong>${masteredCount} / ${week.vocab.length}</strong>
          <span>ord bemästrade</span>
        </div>
      </div>

      <div class="course-filter-bar" role="group" aria-label="Filtrera ordklass">
        ${[
          ['all', `Alla (${week.vocab.length})`],
          ['unmastered', `Kvar att lära (${state.remainingCount})`],
          ['mistakes', `⚠️ Svaga ord (${state.mistakeCount})`],
          ['verb-u', 'U-verb'],
          ['verb-ru', 'Ru-verb'],
          ['verb-irr', 'Oregelbundna verb'],
          ['adjective', 'Adjektiv'],
          ['noun', 'Substantiv'],
          ['expression', 'Uttryck'],
        ].map(
          ([key, label]) => html`
            <button
              type="button"
              class="course-filter-chip ${key === 'mistakes' ? 'chip-mistakes' : ''} ${state.filter === key ? 'active' : ''}"
              @click=${() => {
                vocabDrill.selectFilter(key);
                host.render();
              }}
            >
              ${label}
            </button>
          `,
        )}
      </div>

      ${
        !items.length
          ? html`<div class="course-empty-card" role="status">
              <p>
                ${
                  state.filter === 'mistakes'
                    ? 'Inga svaga ord sparade i denna vecka än! 🎉 När du klickar "Behöver öva mer" på ett kort eller missar ett verb i Dojon hamnar det automatiskt här.'
                    : state.filter === 'unmastered' && week.vocab.length
                      ? 'Alla veckans glosor är bemästrade.'
                      : 'Inga glosor matchar det valda filtret.'
                }
              </p>
              <p>
                ${
                  state.filter === 'mistakes'
                    ? html`<button
                        type="button"
                        class="course-btn-primary"
                        @click=${() => {
                          vocabDrill.selectFilter('all');
                          host.render();
                        }}
                      >
                        Visa alla glosor (${week.vocab.length})
                      </button>`
                    : 'Välj ett annat filter för att fortsätta.'
                }
              </p>
            </div>`
          : vocabMode === 'cards'
            ? html`
                <div class="course-flashcard-stage">
                  <div
                    class="course-flashcard ${state.flipped ? 'flipped' : ''}"
                    role="button"
                    tabindex="0"
                    aria-label="Vänd gloskort"
                    @pointerdown=${(e: PointerEvent) => {
                      const cardEl = e.currentTarget as HTMLElement;
                      bindSwipeableFlashcard(
                        cardEl,
                        {
                          onSwipeLeft: () => {
                            vocabDrill.move(1);
                            host.render();
                          },
                          onSwipeRight: () => {
                            vocabDrill.move(-1);
                            host.render();
                          },
                        },
                        e,
                      );
                    }}
                    @click=${(e: MouseEvent) => {
                      const cardEl = e.currentTarget as HTMLElement;
                      const suppressUntil = Number(cardEl?.dataset?.suppressClickUntil || 0);
                      if (suppressUntil > performance.now()) return;
                      vocabDrill.flip();
                      host.render();
                    }}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        vocabDrill.flip();
                        host.render();
                      } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        vocabDrill.move(1);
                        host.render();
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        vocabDrill.move(-1);
                        host.render();
                      }
                    }}
                  >
                    <div class="course-flashcard-top">
                      <span class="course-card-counter"
                        >Kort ${safeIdx + 1} av ${items.length}</span
                      >
                      <span class="course-cat-tag">${CATEGORY_LABELS[current.category]}</span>
                      ${
                        progress.mistakeVocabIds?.[current.id]
                          ? html`<span class="course-weak-tag">⚠️ Svagt ord</span>`
                          : ''
                      }
                      ${
                        progress.masteredVocabIds[current.id]
                          ? html`<span class="dojo-mastered-tag">✓ Kan detta</span>`
                          : ''
                      }
                    </div>

                    <div class="course-flashcard-center" lang="ja">
                      <h2 class="course-flashcard-jp">${current.kanji || current.kana}</h2>
                      ${
                        current.kanji && current.kanji !== current.kana
                          ? html`<p class="course-flashcard-reading">${current.kana}</p>`
                          : ''
                      }
                      ${
                        host.tts
                          ? html`<button
                              type="button"
                              class="course-tts-btn"
                              title="Lyssna på uttal"
                              @click=${(e: Event) => {
                                e.stopPropagation();
                                const result = host.speak(
                                  current.kana,
                                  e.currentTarget as HTMLElement,
                                );
                                if (result === 'no-voice') {
                                  host.announce?.('Din enhet saknar japansk talsyntesröst');
                                }
                              }}
                            >
                              🔊 Lyssna
                            </button>`
                          : ''
                      }
                    </div>

                    ${
                      state.flipped
                        ? html`
                            <div class="course-flashcard-answer">
                              <h3>${current.sv}</h3>
                              <p class="course-en-sub">${current.en}</p>
                              ${
                                current.noteSv
                                  ? html`<p class="course-vocab-note">💡 ${current.noteSv}</p>`
                                  : ''
                              }
                              <div class="course-example-box">
                                <p lang="ja">${current.exampleJp}</p>
                                <small>${current.exampleSv}</small>
                              </div>
                            </div>
                          `
                        : html`<p class="course-flip-hint">
                            Klicka eller tryck mellanslag för att vända kortet ↻ · Svep för att
                            bläddra ↔
                          </p>`
                    }
                  </div>

                  <div class="course-flashcard-actions">
                    <button
                      type="button"
                      class="course-btn-secondary"
                      @click=${() => {
                        vocabDrill.move(-1);
                        host.render();
                      }}
                    >
                      ← Föregående
                    </button>
                    <button
                      type="button"
                      class="course-btn-retry"
                      @click=${() => markAndAdvance(false)}
                    >
                      Behöver öva mer
                    </button>
                    <button
                      type="button"
                      class="course-btn-success"
                      @click=${() => markAndAdvance(true)}
                    >
                      ✓ Jag kan detta!
                    </button>
                    <button
                      type="button"
                      class="course-btn-secondary"
                      @click=${() => {
                        vocabDrill.move(1);
                        host.render();
                      }}
                    >
                      Nästa →
                    </button>
                  </div>
                </div>
              `
            : html`
                <div class="course-vocab-list">
                  ${items.map((item) => {
                    const isDone = Boolean(progress.masteredVocabIds[item.id]);
                    const isWeak = Boolean(progress.mistakeVocabIds?.[item.id]);
                    return html`
                      <article
                        class="course-vocab-row ${isDone ? 'mastered' : ''} ${isWeak ? 'weak' : ''}"
                      >
                        <div class="course-vocab-row-jp" lang="ja">
                          <strong>${item.kanji || item.kana}</strong>
                          ${
                            item.kanji && item.kanji !== item.kana
                              ? html`<span>${item.kana}</span>`
                              : ''
                          }
                          ${
                            host.tts
                              ? html`<button
                                  type="button"
                                  class="course-tts-inline"
                                  title="Lyssna"
                                  @click=${(e: Event) => {
                                    const result = host.speak(
                                      item.kana,
                                      e.currentTarget as HTMLElement,
                                    );
                                    if (result === 'no-voice') {
                                      host.announce?.('Din enhet saknar japansk talsyntesröst');
                                    }
                                  }}
                                >
                                  🔊
                                </button>`
                              : ''
                          }
                        </div>
                        <div class="course-vocab-row-sv">
                          <div class="row-tags-line">
                            <span class="course-cat-tag">${CATEGORY_LABELS[item.category]}</span>
                            ${isWeak ? html`<span class="course-weak-tag">⚠️ Svagt ord</span>` : ''}
                          </div>
                          <strong>${item.sv}</strong>
                          ${item.noteSv ? html`<small class="note">💡 ${item.noteSv}</small>` : ''}
                          <small lang="ja">${item.exampleJp} — ${item.exampleSv}</small>
                        </div>
                        <div class="course-vocab-row-actions">
                          <button
                            type="button"
                            class="course-weak-toggle ${isWeak ? 'active' : ''}"
                            title=${
                              isWeak
                                ? 'Ta bort från svaga ord'
                                : 'Markera som svagt ord i misstagsbanken'
                            }
                            @click=${() => {
                              const command = vocabDrill.toggleMistake(item.id);
                              if (command) updateProgress(command);
                              host.render();
                            }}
                          >
                            ${isWeak ? '⚠️ Svagt' : '☆ Svagt'}
                          </button>
                          <button
                            type="button"
                            class="course-mastery-toggle ${isDone ? 'active' : ''}"
                            @click=${() => {
                              const command = vocabDrill.toggleMastered(item.id);
                              if (command) updateProgress(command);
                              host.render();
                            }}
                          >
                            ${isDone ? '✓ Kan' : 'Markera'}
                          </button>
                        </div>
                      </article>
                    `;
                  })}
                </div>
              `
      }
    </section>
  `;
}

export function renderKanjiModule(
  week: CourseWeek,
  progress: CourseProgressData,
  host: CourseHostContext,
  updateProgress: UpdateCourseProgress,
  onBackToHub: () => void,
): CourseTemplate {
  const masteredCount = week.kanji.filter((k) => progress.masteredKanjiIds[k.id]).length;

  return html`
    <section class="course-module-section" aria-label="Veckans Kanji">
      <div class="course-module-topbar">
        <button class="course-back-btn" @click=${onBackToHub}>
          ← Tillbaka till ${week.titleSv.split(':')[0]}
        </button>
      </div>

      <div class="dojo-header-banner">
        <div>
          <span class="course-eyebrow">LEKTION ${week.lessonNumber} · KANJIBANK</span>
          <h1>Veckans Kanji (${week.kanji.length} tecken)</h1>
          <p>Studera läsningar (on/kun), minnesbilder och vanliga sammansättningar.</p>
        </div>
        <div class="dojo-score-pill">
          <strong>${masteredCount} / ${week.kanji.length}</strong>
          <span>kanji bemästrade</span>
        </div>
      </div>

      <div class="course-kanji-grid">
        ${week.kanji.map((k) => {
          const isDone = Boolean(progress.masteredKanjiIds[k.id]);
          return html`
            <article class="course-kanji-card ${isDone ? 'mastered' : ''}">
              <div class="course-kanji-card-top">
                <div class="course-kanji-glyph" lang="ja">${k.kanji}</div>
                <div class="course-kanji-meta">
                  <span class="course-strokes-badge">${k.strokes} streck</span>
                  <h3>${k.meaningSv}</h3>
                  ${
                    k.onyomi.length
                      ? html`<p>
                          <small>ON:</small> <span lang="ja">${k.onyomi.join('・')}</span>
                        </p>`
                      : ''
                  }
                  ${
                    k.kunyomi.length
                      ? html`<p>
                          <small>KUN:</small> <span lang="ja">${k.kunyomi.join('・')}</span>
                        </p>`
                      : ''
                  }
                </div>
                <button
                  type="button"
                  class="course-mastery-toggle ${isDone ? 'active' : ''}"
                  @click=${() => {
                    updateProgress({
                      type: 'mastery',
                      kind: 'kanji',
                      id: k.id,
                      mastered: !progress.masteredKanjiIds[k.id],
                    });
                    host.render();
                  }}
                >
                  ${isDone ? '✓ Kan' : 'Markera'}
                </button>
              </div>
              <p class="course-kanji-mnemonic">💡 ${k.mnemonicSv}</p>
              <div class="course-kanji-compounds">
                ${k.compounds.map(
                  (c) => html`
                    <div class="course-compound-item">
                      <span lang="ja"><strong>${c.word}</strong>（${c.reading}）</span>
                      <span>${c.sv}</span>
                    </div>
                  `,
                )}
              </div>
            </article>
          `;
        })}
      </div>
    </section>
  `;
}

export function renderGrammarModule(
  week: CourseWeek,
  host: CourseHostContext,
  onOpenDojo: () => void,
  onBackToHub: () => void,
): CourseTemplate {
  return html`
    <section class="course-module-section" aria-label="Veckans grammatik">
      <div class="course-module-topbar">
        <button class="course-back-btn" @click=${onBackToHub}>
          ← Tillbaka till ${week.titleSv.split(':')[0]}
        </button>
        <button class="course-btn-primary" @click=${onOpenDojo}>Öppna て-form Dojo →</button>
      </div>

      <div class="dojo-header-banner">
        <div>
          <span class="course-eyebrow">LEKTION ${week.lessonNumber} · GRAMMATIKGUIDE</span>
          <h1>Veckans grammatik & mönster</h1>
          <p>Tydliga förklaringar på svenska med formationsregler och exempelmeningar.</p>
        </div>
      </div>

      <div class="course-grammar-list">
        ${week.grammar.map(
          (g) => html`
            <article class="course-grammar-card">
              <div class="course-grammar-header">
                <h2>${g.title}</h2>
                <code class="course-pattern-pill" lang="ja">${g.patternJp}</code>
              </div>
              <p class="course-grammar-lead">${g.summarySv}</p>
              <p class="course-grammar-body">${g.explanationSv}</p>

              <div class="course-grammar-rules">
                <h3>Så bygger du uttrycket:</h3>
                <ul>
                  ${g.formationRules.map((rule) => html`<li>${rule}</li>`)}
                </ul>
              </div>

              ${
                g.warningSv ? html`<div class="course-grammar-warning">⚠️ ${g.warningSv}</div>` : ''
              }

              <div class="course-grammar-examples">
                <h3>Exempelmeningar:</h3>
                ${g.examples.map(
                  (ex) => html`
                    <div class="course-grammar-example">
                      <div class="course-grammar-example-jp" lang="ja">
                        <strong>${ex.jp}</strong>
                        ${
                          host.tts
                            ? html`<button
                                type="button"
                                class="course-tts-inline"
                                title="Lyssna"
                                @click=${(e: Event) => {
                                  const result = host.speak(
                                    ex.kana || ex.jp,
                                    e.currentTarget as HTMLElement,
                                  );
                                  if (result === 'no-voice') {
                                    host.announce?.('Din enhet saknar japansk talsyntesröst');
                                  }
                                }}
                              >
                                🔊
                              </button>`
                            : ''
                        }
                      </div>
                      <small lang="ja">${ex.kana}</small>
                      <p>${ex.sv}</p>
                    </div>
                  `,
                )}
              </div>
            </article>
          `,
        )}
      </div>
    </section>
  `;
}
