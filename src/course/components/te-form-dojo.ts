import { html } from 'lit-html';
import type {
  CourseHostContext,
  CourseProgressData,
  CourseTemplate,
  CourseWeek,
} from '../types.ts';
import { studyDrills } from '../study-drills.ts';
import { courseWeeks } from '../data/index.ts';
import type { UpdateCourseProgress } from '../course-progress.ts';

const dojoDrill = studyDrills.dojo;
const preferences: { inputMode: 'choices' | 'write'; showRuleSheet: boolean } = {
  inputMode: 'choices',
  showRuleSheet: true,
};

export function setDojoPreferences(prefs: Partial<typeof preferences>): void {
  Object.assign(preferences, prefs);
}

if (
  typeof window !== 'undefined' &&
  !(window as unknown as { __dojoEnterAttached?: boolean }).__dojoEnterAttached
) {
  (window as unknown as { __dojoEnterAttached?: boolean }).__dojoEnterAttached = true;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const feedback = document.querySelector('.dojo-feedback-box');
      const nextBtn = document.querySelector(
        '.dojo-footer-nav .course-btn-primary',
      ) as HTMLButtonElement | null;
      if (feedback && nextBtn) {
        e.preventDefault();
        nextBtn.click();
      }
    }
  });
}

export function renderTeFormDojo(
  week: CourseWeek,
  progress: CourseProgressData,
  host: CourseHostContext,
  updateProgress: UpdateCourseProgress,
  onBackToHub: () => void,
): CourseTemplate {
  const state = dojoDrill.read(week, courseWeeks, progress);
  const { current, index: safeIndex, choices, masteredCount, total, targetForm, expected } = state;
  const targetFormName =
    targetForm === 'nai' ? 'ない-form' : targetForm === 'ta' ? 'た-form' : 'て-form';

  if (!current) {
    return html`<div class="course-empty-card">
      <h2>
        ${
          state.weekFilter === 'mistakes'
            ? 'Inga svaga verb sparade! 🎉'
            : 'Inga böjningsövningar i detta urval.'
        }
      </h2>
      <p>
        ${
          state.weekFilter === 'mistakes'
            ? 'Alla verb du tränat i Dojon har suttit! Eventuella felaktiga svar sparas automatiskt här så att du kan nöta dem inför tentan.'
            : ''
        }
      </p>
      <button
        class="course-btn-primary"
        @click=${() => {
          if (state.weekFilter === 'mistakes') {
            dojoDrill.selectFilter('current');
            host.render();
          } else {
            onBackToHub();
          }
        }}
      >
        ${state.weekFilter === 'mistakes' ? 'Visa alla veckans verb' : 'Tillbaka till veckan'}
      </button>
    </div>`;
  }

  const submitAnswer = (val: string) => {
    const command = dojoDrill.submit(val);
    if (command) {
      updateProgress(command);
      if (command.type === 'mastery' && !command.mastered && current) {
        const matchVocab = week.vocab.find(
          (v) =>
            v.kana === current.dictionaryKana || (v.kanji && v.kanji === current.dictionaryKanji),
        );
        if (matchVocab) {
          updateProgress({ type: 'mistake', kind: 'vocab', id: matchVocab.id, mistake: true });
        }
      }
    }
    host.render();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        const nextBtn = document.querySelector(
          '.dojo-footer-nav .course-btn-primary',
        ) as HTMLElement | null;
        nextBtn?.focus();
      });
    }
  };

  const goNext = (delta: number) => {
    dojoDrill.move(delta);
    host.render();
    if (typeof requestAnimationFrame !== 'undefined' && preferences.inputMode === 'write') {
      requestAnimationFrame(() => {
        const input = document.getElementById('dojo-input') as HTMLInputElement | null;
        input?.focus();
      });
    }
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
          <div class="course-pill-switch" role="group" aria-label="Målform">
            <button
              type="button"
              class=${targetForm === 'te' ? 'active' : ''}
              @click=${() => {
                dojoDrill.selectTargetForm('te');
                host.render();
              }}
            >
              て-form
            </button>
            <button
              type="button"
              class=${targetForm === 'nai' ? 'active' : ''}
              @click=${() => {
                dojoDrill.selectTargetForm('nai');
                host.render();
              }}
            >
              ない-form
            </button>
            <button
              type="button"
              class=${targetForm === 'ta' ? 'active' : ''}
              @click=${() => {
                dojoDrill.selectTargetForm('ta');
                host.render();
              }}
            >
              た-form
            </button>
          </div>
          <div class="course-pill-switch" role="group" aria-label="Urval i Dojo">
            <button
              type="button"
              class=${state.weekFilter === 'current' ? 'active' : ''}
              @click=${() => {
                dojoDrill.selectFilter('current');
                host.render();
              }}
            >
              Denna vecka (${week.conjugations.length})
            </button>
            <button
              type="button"
              class=${state.weekFilter === 'all' ? 'active' : ''}
              @click=${() => {
                dojoDrill.selectFilter('all');
                host.render();
              }}
            >
              Alla veckor (${courseWeeks.flatMap((w) => w.conjugations).length})
            </button>
            <button
              type="button"
              class=${state.weekFilter === 'mistakes' ? 'active' : ''}
              @click=${() => {
                dojoDrill.selectFilter('mistakes');
                host.render();
              }}
            >
              ⚠️ Svaga verb (${state.mistakeCount})
            </button>
          </div>
          <div class="course-pill-switch" role="group" aria-label="Svarsläge">
            <button
              type="button"
              class=${preferences.inputMode === 'choices' ? 'active' : ''}
              @click=${() => {
                preferences.inputMode = 'choices';
                host.render();
              }}
            >
              Flerval
            </button>
            <button
              type="button"
              class=${preferences.inputMode === 'write' ? 'active' : ''}
              @click=${() => {
                preferences.inputMode = 'write';
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
          <strong>${masteredCount} / ${total}</strong>
          <span>bemästrade verb</span>
        </div>
      </div>

      <details class="dojo-cheatsheet" ?open=${preferences.showRuleSheet}>
        <summary
          @click=${(e: Event) => {
            e.preventDefault();
            preferences.showRuleSheet = !preferences.showRuleSheet;
            host.render();
          }}
        >
          <span
            >🎵 Minnesschema:
            ${
              targetForm === 'nai'
                ? 'Böjningsregler för kortform nekande (ない-form)'
                : targetForm === 'ta'
                  ? 'Böjningsregler för dåtid i kortform (た-form)'
                  : 'Alla て-form-regler på 10 sekunder'
            }</span
          >
          <small>${preferences.showRuleSheet ? 'Dölj' : 'Visa'}</small>
        </summary>
        <div class="dojo-rules-grid">
          ${
            targetForm === 'nai'
              ? html`
                  <div class="dojo-rule-chip">
                    <strong>う → わない</strong>
                    <span>買う → 買わない · 会う → 会わない · 言う → 言わない</span>
                  </div>
                  <div class="dojo-rule-chip">
                    <strong>つ・る → たない・らない</strong>
                    <span>待つ → 待たない · 帰る → 帰らない · 取る → 取らない</span>
                  </div>
                  <div class="dojo-rule-chip">
                    <strong>む・ぶ・ぬ → まない・ばない・なない</strong>
                    <span>飲む → 飲まない · 遊ぶ → 遊ばない · 死ぬ → 死なない</span>
                  </div>
                  <div class="dojo-rule-chip">
                    <strong>く・ぐ・す → かない・がない・さない</strong>
                    <span>書く → 書かない · 泳ぐ → 泳がない · 話す → 話さない</span>
                  </div>
                  <div class="dojo-rule-chip">
                    <strong>Ru-verb (Ichidan): る bort + ない</strong>
                    <span>食べる → 食べない · 見る → 見ない · 忘れる → 忘れない</span>
                  </div>
                  <div class="dojo-rule-chip highlight">
                    <strong>⚠️ Oregelbundna verb</strong>
                    <span>する → しない · 来る(くる) → こない · ある → ない</span>
                  </div>
                `
              : targetForm === 'ta'
                ? html`
                    <div class="dojo-rule-chip">
                      <strong>う・つ・る → った</strong>
                      <span>買う → 買った · 待つ → 待った · 帰る → 帰った</span>
                    </div>
                    <div class="dojo-rule-chip">
                      <strong>む・ぶ・ぬ → んだ</strong>
                      <span>読む → 読んだ · 遊ぶ → 遊んだ · 飲む → 飲んだ</span>
                    </div>
                    <div class="dojo-rule-chip">
                      <strong>く → いた (ぐ → いだ)</strong>
                      <span>書く → 書いた · 泳ぐ → 泳いだ</span>
                    </div>
                    <div class="dojo-rule-chip highlight">
                      <strong>⚠️ Undantag: 行く → 行った</strong>
                      <span>行く blir いった (inte いいた)!</span>
                    </div>
                    <div class="dojo-rule-chip">
                      <strong>す → した</strong>
                      <span>話す → 話した · 出す → 出した</span>
                    </div>
                    <div class="dojo-rule-chip">
                      <strong>Ru-verb & Oregelbundna</strong>
                      <span>食べる → 食べた · する → した · 来る → 来た(きた)</span>
                    </div>
                  `
                : html`
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
                  `
          }
        </div>
      </details>

      <div
        class="dojo-arena-card"
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' && state.revealed) {
            e.preventDefault();
            goNext(1);
          }
        }}
      >
        <div class="dojo-arena-meta">
          <span class="dojo-step-counter">Verb ${safeIndex + 1} av ${total}</span>
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
              current.teFormKana && (targetFormName !== 'て-form' || state.revealed)
                ? html`<span>て-form: <strong lang="ja">${current.teFormKana}</strong></span>`
                : ''
            }
            ${
              current.naiFormKana && (targetFormName !== 'ない-form' || state.revealed)
                ? html`<span
                    >ない-form (L8): <strong lang="ja">${current.naiFormKana}</strong></span
                  >`
                : ''
            }
            ${
              current.taFormKana && (targetFormName !== 'た-form' || state.revealed)
                ? html`<span>た-form (L9): <strong lang="ja">${current.taFormKana}</strong></span>`
                : ''
            }
          </div>
        </div>

        ${
          preferences.inputMode === 'choices'
            ? html`<div
                class="dojo-choices-grid"
                role="group"
                aria-label="Välj rätt ${targetFormName}"
              >
                ${choices.map((choice) => {
                  const isSelected = state.selectedAnswer === choice;
                  const isAnswer = choice === expected.kana;
                  let stateClass = '';
                  if (state.revealed) {
                    if (isAnswer) stateClass = 'correct';
                    else if (isSelected) stateClass = 'wrong';
                  }
                  const showKanjiVariant =
                    state.revealed &&
                    isAnswer &&
                    Boolean(expected.kanji) &&
                    expected.kanji !== choice;
                  return html`<button
                    type="button"
                    class="dojo-choice-btn ${stateClass}"
                    ?disabled=${state.revealed}
                    lang="ja"
                    @click=${() => submitAnswer(choice)}
                    aria-label="${showKanjiVariant ? `${choice} / ${expected.kanji}` : choice}"
                  >
                    <span class="dojo-choice-kana">${choice}</span>
                    ${
                      showKanjiVariant
                        ? html`<span class="dojo-choice-sep" aria-hidden="true">/</span
                            ><span class="dojo-choice-kanji">${expected.kanji}</span>`
                        : ''
                    }
                  </button>`;
                })}
              </div>`
            : html`<form
                class="dojo-write-form"
                @submit=${(e: Event) => {
                  e.preventDefault();
                  const command = dojoDrill.submitInput();
                  if (command) updateProgress(command);
                  host.render();
                  if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(() => {
                      const nextBtn = document.querySelector(
                        '.dojo-footer-nav .course-btn-primary',
                      ) as HTMLElement | null;
                      nextBtn?.focus();
                    });
                  }
                }}
              >
                <label for="dojo-input" class="sr-only">Skriv ${targetFormName} på japanska</label>
                <input
                  id="dojo-input"
                  type="text"
                  lang="ja"
                  class="dojo-text-input"
                  placeholder="Skriv ${targetFormName} i kana eller kanji..."
                  .value=${state.typedAnswer}
                  ?disabled=${state.revealed}
                  @input=${(e: Event) => {
                    dojoDrill.setInput((e.target as HTMLInputElement).value);
                  }}
                />
                ${
                  !state.revealed
                    ? html`<button type="submit" class="course-btn-primary">
                        Kontrollera ${targetFormName}
                      </button>`
                    : ''
                }
              </form>`
        }
        ${
          state.revealed
            ? html`<div class="dojo-feedback-box ${state.isCorrect ? 'ok' : 'err'}" role="status">
                <div class="dojo-feedback-header">
                  <strong>
                    ${state.isCorrect ? '✨ Helt rätt!' : '💡 Inte riktigt — se ljudregeln:'}
                  </strong>
                  <div class="dojo-feedback-tags">
                    ${
                      !state.isCorrect
                        ? html`<span class="dojo-mistake-pill">⚠️ Sparat i misstagsbanken</span>`
                        : ''
                    }
                    <span class="dojo-rule-pill">${current.ruleLabelSv}</span>
                  </div>
                </div>
                <p class="dojo-conversion-line" lang="ja">
                  ${current.dictionaryKanji} (${current.dictionaryKana}) ➔
                  <strong>${expected.kanji} (${expected.kana})</strong>
                  ${targetFormName !== 'て-form' ? html` · て-form: <b>${current.teFormKana}</b>` : ''}
                  ${targetFormName !== 'ない-form' && current.naiFormKana ? html` · ない-form: <b>${current.naiFormKana}</b>` : ''}
                  ${targetFormName !== 'た-form' && current.taFormKana ? html` · た-form: <b>${current.taFormKana}</b>` : ''}
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
          <button
            type="button"
            class="course-btn-primary"
            ?autofocus=${state.revealed}
            @click=${() => goNext(1)}
          >
            Nästa verb →
          </button>
        </div>
      </div>
    </section>
  `;
}
