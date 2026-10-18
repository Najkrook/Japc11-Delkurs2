import { html } from 'lit-html';
import type {
  CourseHostContext,
  CourseProgressData,
  CourseTemplate,
  CourseWeek,
} from '../types.ts';
import { studyDrills } from '../study-drills.ts';
import type { UpdateCourseProgress } from '../course-progress.ts';

const quizDrill = studyDrills.quiz;

const QUIZ_CAT_LABELS: Record<string, string> = {
  'te-form': 'て-form',
  grammar: 'Grammatik',
  vocab: 'Ordförråd',
  kanji: 'Kanji',
};

export function renderWeekQuizModule(
  week: CourseWeek,
  _progress: CourseProgressData,
  host: CourseHostContext,
  updateProgress: UpdateCourseProgress,
  onBackToHub: () => void,
): CourseTemplate {
  const state = quizDrill.read(week);
  const { questions, total, score } = state;
  if (!questions.length) {
    return html`<div class="course-empty-card">
      <h2>Inga testfrågor i denna vecka än.</h2>
      <button class="course-btn-primary" @click=${onBackToHub}>Tillbaka</button>
    </div>`;
  }

  if (state.finished) {
    const pct = Math.round((score / total) * 100);
    return html`
      <section class="course-module-section" aria-label="Resultat för veckans minitest">
        <div class="course-quiz-result-card">
          <span class="course-eyebrow"
            >VECKANS MIXPASS AVKLARAT · LEKTION ${week.lessonNumber}</span
          >
          <h1>${pct >= 80 ? '🎉 Strålande jobbat!' : '💪 Bra kämpat!'}</h1>
          <div class="course-quiz-score-circle">
            <strong>${score} / ${total}</strong>
            <span>rätt (${pct}%)</span>
          </div>
          <p>
            ${
              pct === 100
                ? 'Full pott! Du har stenkoll på veckans moment.'
                : 'Kika igenom förklaringarna nedan för de frågor du vill repetera.'
            }
          </p>

          <div class="course-quiz-review-list">
            ${questions.map((q, i) => {
              const userAns = state.answers[q.id];
              const ok = userAns === q.answer;
              return html`
                <div class="course-quiz-review-item ${ok ? 'ok' : 'err'}">
                  <div class="course-quiz-review-head">
                    <span>#${i + 1} · ${QUIZ_CAT_LABELS[q.category]}</span>
                    <strong>${ok ? '✓ Rätt' : '✗ Fel'}</strong>
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
                quizDrill.reset(week.id);
                host.render();
              }}
            >
              🔄 Gör om testet
            </button>
            <button type="button" class="course-btn-primary" @click=${onBackToHub}>
              Tillbaka till veckoöversikten →
            </button>
          </div>
        </div>
      </section>
    `;
  }

  const { index: safeIdx, current, chosen } = state;

  const chooseOption = (choice: string) => {
    quizDrill.choose(choice);
    host.render();
  };

  const advance = () => {
    const command = quizDrill.advance();
    if (command) updateProgress(command);
    host.render();
  };

  return html`
    <section class="course-module-section" aria-label="Veckans Mixpass">
      <div class="course-module-topbar">
        <button class="course-back-btn" @click=${onBackToHub}>← Avbryt och gå tillbaka</button>
        <span class="course-quiz-progress-label">
          Fråga ${safeIdx + 1} av ${total} · Lektion ${week.lessonNumber}
        </span>
      </div>

      <div class="course-quiz-progress-bar">
        <span style="width: ${((safeIdx + 1) / total) * 100}%"></span>
      </div>

      <div class="dojo-arena-card course-quiz-card">
        <div class="dojo-arena-meta">
          <span class="dojo-step-counter">Fråga ${safeIdx + 1} / ${total}</span>
          <span class="course-cat-tag">${QUIZ_CAT_LABELS[current.category]}</span>
        </div>

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
