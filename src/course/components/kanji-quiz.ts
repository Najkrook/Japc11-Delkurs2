import { html } from 'lit-html';
import type {
  CourseHostContext,
  CourseProgressData,
  CourseTemplate,
  CourseWeek,
} from '../types.ts';
import { studyDrills } from '../study-drills.ts';
import type { UpdateCourseProgress } from '../course-progress.ts';

const kanjiQuizDrill = studyDrills.kanjiQuiz;

export function renderKanjiQuizModule(
  week: CourseWeek,
  progress: CourseProgressData,
  host: CourseHostContext,
  updateProgress: UpdateCourseProgress,
  onExitQuiz: () => void,
): CourseTemplate {
  const state = kanjiQuizDrill.read(week);
  const { questions, total, score } = state;

  if (!questions.length) {
    return html`
      <div class="course-empty-card">
        <h2>Inga kanji att testa i denna vecka än.</h2>
        <button class="course-btn-primary" @click=${onExitQuiz}>Tillbaka till Kanjibanken</button>
      </div>
    `;
  }

  // Result screen when finished
  if (state.finished) {
    const pct = Math.round((score / total) * 100);

    // Identify kanji that were answered correctly
    const correctKanjiIds = Array.from(
      new Set(
        questions
          .filter((q) => q.kanjiId && state.answers[q.id] === q.answer)
          .map((q) => q.kanjiId!),
      ),
    );
    const unmasteredCorrect = correctKanjiIds.filter((id) => !progress.masteredKanjiIds[id]);

    return html`
      <section class="course-module-section" aria-label="Resultat för veckans kanji-quiz">
        <div class="course-quiz-result-card">
          <span class="course-eyebrow">
            KANJI-QUIZ AVKLARAT · LEKTION ${week.lessonNumber}
          </span>
          <h1>
            ${pct >= 90 ? '🌟 Fantastiskt kanji-minne!' : pct >= 70 ? '🎉 Riktigt bra jobbat!' : '💪 Bra kämpat, övning ger färdighet!'}
          </h1>
          <div class="course-quiz-score-circle">
            <strong>${score} / ${total}</strong>
            <span>rätt (${pct}%)</span>
          </div>
          <p>
            ${
              pct === 100
                ? 'Full pott! Du har järnkoll på veckans kanji, läsningar och sammansättningar.'
                : 'Gå igenom förklaringarna nedan för att repetera tecknen och minnesreglerna.'
            }
          </p>

          ${
            unmasteredCorrect.length > 0
              ? html`
                  <div class="kanji-quiz-mastery-action">
                    <button
                      type="button"
                      class="course-btn-primary"
                      @click=${() => {
                        unmasteredCorrect.forEach((id) => {
                          updateProgress({
                            type: 'mastery',
                            kind: 'kanji',
                            id,
                            mastered: true,
                          });
                        });
                        host.render();
                      }}
                    >
                      ✨ Markera ${unmasteredCorrect.length} godkända kanji som bemästrade
                    </button>
                  </div>
                `
              : ''
          }

          <div class="course-quiz-review-list">
            ${questions.map((q, i) => {
              const userAns = state.answers[q.id];
              const ok = userAns === q.answer;
              return html`
                <div class="course-quiz-review-item ${ok ? 'ok' : 'err'}">
                  <div class="course-quiz-review-head">
                    <span>#${i + 1} · Kanji</span>
                    <strong>${ok ? '✓ Rätt' : '✗ Fel svar'}</strong>
                  </div>
                  <p class="prompt">${q.prompt}</p>
                  <p class="ans">
                    Ditt svar: <b>${userAns || '—'}</b>
                    ${!ok ? html` · Rätt svar: <b class="correct-text">${q.answer}</b>` : ''}
                  </p>
                  <small>${q.explanationSv}</small>
                </div>
              `;
            })}
          </div>

          <div class="course-quiz-result-actions">
            <button
              type="button"
              class="course-btn-secondary"
              @click=${() => {
                kanjiQuizDrill.start(week);
                host.render();
              }}
            >
              🔄 Gör om testet med nya frågor
            </button>
            <button type="button" class="course-btn-primary" @click=${onExitQuiz}>
              Tillbaka till Kanjibanken →
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // Active quiz screen
  const { index: safeIdx, current, chosen } = state;

  const chooseOption = (choice: string) => {
    kanjiQuizDrill.choose(choice);
    host.render();
  };

  const advance = () => {
    kanjiQuizDrill.advance();
    host.render();
  };

  return html`
    <section class="course-module-section" aria-label="Veckans Kanji-Quiz">
      <div class="course-module-topbar">
        <button class="course-back-btn" @click=${onExitQuiz}>
          ← Avbryt och gå till Kanjibanken
        </button>
        <span class="course-quiz-progress-label">
          Fråga ${safeIdx + 1} av ${total} · Kanji-Quiz Lektion ${week.lessonNumber}
        </span>
      </div>

      <div class="course-quiz-progress-bar">
        <span style="width: ${((safeIdx + 1) / total) * 100}%"></span>
      </div>

      <div class="dojo-arena-card course-quiz-card">
        <div class="dojo-arena-meta">
          <span class="dojo-step-counter">Fråga ${safeIdx + 1} / ${total}</span>
          <span class="course-cat-tag">Kanji · Lektion ${week.lessonNumber}</span>
        </div>

        ${
          current.contextJp && current.contextJp.length <= 2
            ? html`<div class="kanji-quiz-hero-glyph" lang="ja">${current.contextJp}</div>`
            : ''
        }

        <h1 class="course-quiz-prompt">${current.prompt}</h1>

        <div class="dojo-choices-grid" role="group" aria-label="Svarsalternativ">
          ${current.choices.map((choice) => {
            const isSelected = chosen === choice;
            const isCorrect = choice === current.answer;
            let stateClass = '';
            if (chosen !== null) {
              if (isCorrect) stateClass = 'correct';
              else if (isSelected) stateClass = 'wrong';
            }
            return html`
              <button
                type="button"
                class="dojo-choice-btn ${stateClass}"
                ?disabled=${chosen !== null}
                @click=${() => chooseOption(choice)}
              >
                <span>${choice}</span>
              </button>
            `;
          })}
        </div>

        ${
          chosen !== null
            ? html`
                <div
                  class="dojo-feedback-box ${chosen === current.answer ? 'ok' : 'err'}"
                  role="status"
                >
                  <strong>
                    ${chosen === current.answer ? '✨ Rätt svar!' : `💡 Rätt svar: ${current.answer}`}
                  </strong>
                  <p>${current.explanationSv}</p>
                </div>
                <div class="dojo-footer-nav">
                  <span></span>
                  <button type="button" class="course-btn-primary" @click=${advance}>
                    ${safeIdx < total - 1 ? 'Nästa fråga →' : 'Visa resultat 🏁'}
                  </button>
                </div>
              `
            : ''
        }
      </div>
    </section>
  `;
}
