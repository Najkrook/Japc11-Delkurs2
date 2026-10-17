import { html } from 'lit-html';
import type {
  CourseHostContext,
  CourseProgressData,
  CourseTemplate,
  CourseWeek,
  VerbConjugationItem,
} from '../types.ts';
import { courseWeeks } from '../data/index.ts';
import { setDojoMastered } from '../course-state.ts';

interface DojoUiState {
  weekFilter: string; // 'current' | 'all'
  index: number;
  selectedAnswer: string | null;
  typedAnswer: string;
  inputMode: 'choices' | 'write';
  revealed: boolean;
  isCorrect: boolean | null;
  showRuleSheet: boolean;
}

const dojoState: DojoUiState = {
  weekFilter: 'current',
  index: 0,
  selectedAnswer: null,
  typedAnswer: '',
  inputMode: 'choices',
  revealed: false,
  isCorrect: null,
  showRuleSheet: true,
};

export function resetDojoUiState(): void {
  dojoState.index = 0;
  dojoState.selectedAnswer = null;
  dojoState.typedAnswer = '';
  dojoState.revealed = false;
  dojoState.isCorrect = null;
}

function normalizeJp(str: string): string {
  return str.trim().replace(/\s+/g, '');
}

export function buildDojoChoices(item: VerbConjugationItem): string[] {
  const stemKana = item.dictionaryKana.slice(0, -1);
  const candidates = new Set<string>([item.teFormKana]);

  const distractors = [
    `${stemKana}って`,
    `${stemKana}んで`,
    `${stemKana}いて`,
    `${stemKana}いで`,
    `${stemKana}して`,
    `${stemKana}て`,
    `${item.dictionaryKana}て`,
  ];

  for (const d of distractors) {
    if (candidates.size >= 4) break;
    if (d !== item.teFormKana && d.length >= 2) {
      candidates.add(d);
    }
  }

  return Array.from(candidates).sort((a, b) => a.localeCompare(b, 'ja'));
}

export function renderTeFormDojo(
  week: CourseWeek,
  progress: CourseProgressData,
  host: CourseHostContext,
  onPersist: () => void,
  onBackToHub: () => void,
): CourseTemplate {
  const pool: VerbConjugationItem[] =
    dojoState.weekFilter === 'all' ? courseWeeks.flatMap((w) => w.conjugations) : week.conjugations;

  if (pool.length === 0) {
    return html`<div class="course-empty-card">
      <h2>Inga böjningsövningar i detta urval.</h2>
      <button class="course-btn-primary" @click=${onBackToHub}>Tillbaka till veckan</button>
    </div>`;
  }

  const safeIndex = ((dojoState.index % pool.length) + pool.length) % pool.length;
  const current = pool[safeIndex];
  const choices = buildDojoChoices(current);
  const masteredCount = pool.filter((c) => progress.masteredDojoIds[c.id]).length;

  const submitAnswer = (val: string) => {
    const clean = normalizeJp(val);
    if (!clean) return;
    const ok =
      clean === normalizeJp(current.teFormKana) || clean === normalizeJp(current.teFormKanji);
    dojoState.selectedAnswer = val;
    dojoState.revealed = true;
    dojoState.isCorrect = ok;
    setDojoMastered(progress, current.id, ok);
    onPersist();
    host.render();
  };

  const goNext = (delta: number) => {
    dojoState.index = (safeIndex + delta + pool.length) % pool.length;
    dojoState.selectedAnswer = null;
    dojoState.typedAnswer = '';
    dojoState.revealed = false;
    dojoState.isCorrect = null;
    host.render();
  };

  const groupBadgeLabel =
    current.group === 'u-verb'
      ? 'U-verb (Godan)'
      : current.group === 'ru-verb'
        ? 'Ru-verb (Ichidan)'
        : 'Oregelbundet verb';

  return html`
    <section class="course-module-section" aria-label="て-form Dojo">
      <div class="course-module-topbar">
        <button class="course-back-btn" @click=${onBackToHub}>
          ← Tillbaka till ${week.titleSv.split(':')[0]}
        </button>
        <div class="course-module-controls">
          <div class="course-pill-switch" role="group" aria-label="Urval i Dojo">
            <button
              type="button"
              class=${dojoState.weekFilter === 'current' ? 'active' : ''}
              @click=${() => {
                dojoState.weekFilter = 'current';
                resetDojoUiState();
                host.render();
              }}
            >
              Denna vecka (${week.conjugations.length})
            </button>
            <button
              type="button"
              class=${dojoState.weekFilter === 'all' ? 'active' : ''}
              @click=${() => {
                dojoState.weekFilter = 'all';
                resetDojoUiState();
                host.render();
              }}
            >
              Alla veckor (${courseWeeks.flatMap((w) => w.conjugations).length})
            </button>
          </div>
          <div class="course-pill-switch" role="group" aria-label="Svarsläge">
            <button
              type="button"
              class=${dojoState.inputMode === 'choices' ? 'active' : ''}
              @click=${() => {
                dojoState.inputMode = 'choices';
                host.render();
              }}
            >
              Flerval
            </button>
            <button
              type="button"
              class=${dojoState.inputMode === 'write' ? 'active' : ''}
              @click=${() => {
                dojoState.inputMode = 'write';
                host.render();
              }}
            >
              Skriv själv
            </button>
          </div>
        </div>
      </div>

      <div class="dojo-header-banner">
        <div>
          <span class="course-eyebrow">INTERAKTIV BÖJNINGSSTATION · て-FORM DOJO</span>
          <h1>Träna verbens て-form steg för steg</h1>
          <p>
            Se grundform, ます-form och verbgrupp — välj eller skriv rätt て-form och få direkt
            förklaring av ljudregeln.
          </p>
        </div>
        <div class="dojo-score-pill">
          <strong>${masteredCount} / ${pool.length}</strong>
          <span>bemästrade verb</span>
        </div>
      </div>

      <details class="dojo-cheatsheet" ?open=${dojoState.showRuleSheet}>
        <summary
          @click=${(e: Event) => {
            e.preventDefault();
            dojoState.showRuleSheet = !dojoState.showRuleSheet;
            host.render();
          }}
        >
          <span>🎵 Minnesschema: Alla て-form-regler på 10 sekunder</span>
          <small>${dojoState.showRuleSheet ? 'Dölj' : 'Visa'}</small>
        </summary>
        <div class="dojo-rules-grid">
          <div class="dojo-rule-chip">
            <strong>う・つ・る → って</strong>
            <span>買う → 買って · 待つ → 待って · 座る → 座って</span>
          </div>
          <div class="dojo-rule-chip">
            <strong>む・ぶ・ぬ → んで</strong>
            <span>読む → 読んで · 遊ぶ → 遊んで · 死ぬ → 死んで</span>
          </div>
          <div class="dojo-rule-chip">
            <strong>く → いて (ぐ → いで)</strong>
            <span>書く → 書いて · 急ぐ → 急いで</span>
          </div>
          <div class="dojo-rule-chip highlight">
            <strong>⚠️ Undantag: 行く → 行って</strong>
            <span>行く blir いって (inte いいて)! 入る & 帰る & 知る = u-verb!</span>
          </div>
          <div class="dojo-rule-chip">
            <strong>す → して</strong>
            <span>話す → 話して · 返す → 返して</span>
          </div>
          <div class="dojo-rule-chip">
            <strong>Ru-verb & Oregelbundna</strong>
            <span>開ける → 開けて · する → して · 来る(くる) → 来て(きて)</span>
          </div>
        </div>
      </details>

      <div class="dojo-arena-card">
        <div class="dojo-arena-meta">
          <span class="dojo-step-counter">Verb ${safeIndex + 1} av ${pool.length}</span>
          <span class="dojo-verb-group-badge ${current.group}">${groupBadgeLabel}</span>
          ${
            progress.masteredDojoIds[current.id]
              ? html`<span class="dojo-mastered-tag">✓ Bemästrad</span>`
              : ''
          }
        </div>

        <div class="dojo-verb-showcase">
          <div class="dojo-verb-main" lang="ja">
            <span class="dojo-verb-kanji">${current.dictionaryKanji}</span>
            <span class="dojo-verb-kana">（${current.dictionaryKana}）</span>
            ${
              host.tts
                ? html`<button
                    type="button"
                    class="course-tts-btn"
                    title="Lyssna på uttal"
                    @click=${(e: Event) =>
                      host.speak(current.dictionaryKana, e.currentTarget as HTMLElement)}
                  >
                    🔊
                  </button>`
                : ''
            }
          </div>
          <div class="dojo-verb-sub">
            <span>ます-form: <strong lang="ja">${current.politeMasu}</strong></span>
            <span>Betydelse: <strong>${current.sv}</strong></span>
            ${
              current.naiFormKana
                ? html`<span
                    >ない-form (L8): <strong lang="ja">${current.naiFormKana}</strong></span
                  >`
                : ''
            }
            ${
              current.taFormKana
                ? html`<span>た-form (L9): <strong lang="ja">${current.taFormKana}</strong></span>`
                : ''
            }
          </div>
        </div>

        ${
          dojoState.inputMode === 'choices'
            ? html`<div class="dojo-choices-grid" role="group" aria-label="Välj rätt て-form">
                ${choices.map((choice) => {
                  const isSelected = dojoState.selectedAnswer === choice;
                  const isAnswer = choice === current.teFormKana;
                  let stateClass = '';
                  if (dojoState.revealed) {
                    if (isAnswer) stateClass = 'correct';
                    else if (isSelected) stateClass = 'wrong';
                  }
                  return html`<button
                    type="button"
                    class="dojo-choice-btn ${stateClass}"
                    ?disabled=${dojoState.revealed}
                    lang="ja"
                    @click=${() => submitAnswer(choice)}
                  >
                    <span class="dojo-choice-kana">${choice}</span>
                    ${
                      dojoState.revealed && isAnswer
                        ? html`<small>${current.teFormKanji}</small>`
                        : ''
                    }
                  </button>`;
                })}
              </div>`
            : html`<form
                class="dojo-write-form"
                @submit=${(e: Event) => {
                  e.preventDefault();
                  if (!dojoState.revealed) {
                    submitAnswer(dojoState.typedAnswer);
                  } else {
                    goNext(1);
                  }
                }}
              >
                <label for="dojo-input" class="sr-only">Skriv て-form på japanska</label>
                <input
                  id="dojo-input"
                  type="text"
                  lang="ja"
                  class="dojo-text-input"
                  placeholder="Skriv て-form i kana eller kanji (t.ex. ${current.teFormKana})..."
                  .value=${dojoState.typedAnswer}
                  ?disabled=${dojoState.revealed}
                  @input=${(e: Event) => {
                    dojoState.typedAnswer = (e.target as HTMLInputElement).value;
                  }}
                />
                ${
                  !dojoState.revealed
                    ? html`<button type="submit" class="course-btn-primary">
                        Kontrollera て-form
                      </button>`
                    : ''
                }
              </form>`
        }
        ${
          dojoState.revealed
            ? html`<div
                class="dojo-feedback-box ${dojoState.isCorrect ? 'ok' : 'err'}"
                role="status"
              >
                <div class="dojo-feedback-header">
                  <strong>
                    ${dojoState.isCorrect ? '✨ Helt rätt!' : '💡 Inte riktigt — se ljudregeln:'}
                  </strong>
                  <span class="dojo-rule-pill">${current.ruleLabelSv}</span>
                </div>
                <p class="dojo-conversion-line" lang="ja">
                  ${current.dictionaryKanji} (${current.dictionaryKana}) ➔
                  <strong>${current.teFormKanji} (${current.teFormKana})</strong>
                  ${current.naiFormKana ? html` · ない-form: <b>${current.naiFormKana}</b>` : ''}
                  ${current.taFormKana ? html` · た-form: <b>${current.taFormKana}</b>` : ''}
                </p>
                <p>${current.ruleExplanationSv}</p>
                <div class="dojo-example-strip">
                  <span lang="ja">📖 ${current.exampleJp}</span>
                  <small>${current.exampleSv}</small>
                </div>
              </div>`
            : ''
        }

        <div class="dojo-footer-nav">
          <button type="button" class="course-btn-secondary" @click=${() => goNext(-1)}>
            ← Föregående verb
          </button>
          <button type="button" class="course-btn-primary" @click=${() => goNext(1)}>
            Nästa verb →
          </button>
        </div>
      </div>
    </section>
  `;
}
