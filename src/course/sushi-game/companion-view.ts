import { html } from 'lit-html';
import { courseWeeks } from '../data/index.ts';
import { getWeekProgressSummary } from '../course-state.ts';
import type { CourseProgressData } from '../types.ts';
import { SUSHI_CATALOG } from './catalog.ts';
import { unitsToWholeYen } from './economy.ts';
import { SUSHI_PROJECTS, projectEligibility } from './projects.ts';
import { getChapterHonors, getSushiGoals } from './study-companion.ts';
import { SUSHI_SPRITES, spriteStyle } from './restaurant-scene.ts';
import type { SushiRestaurantState } from './types.ts';

export type SushiGoalMode = 'grow' | 'personalize';
const yen = (value: number) => value.toLocaleString('sv-SE');

export function isRestaurantComplete(state: SushiRestaurantState): boolean {
  return SUSHI_CATALOG.every((item) => state.inventory.includes(item.id));
}

export function renderCompanionGoal(
  state: SushiRestaurantState,
  mode: SushiGoalMode,
  progress: CourseProgressData | null | undefined,
  actions: {
    chooseMode: (mode: SushiGoalMode) => void;
    openShop: (itemId: string) => void;
    openJournal: () => void;
    study: (lesson: number, weekId: string) => void;
    replayFinale: () => void;
  },
) {
  const goal = getSushiGoals(state)[mode];
  const week = goal && courseWeeks.find((item) => item.id === goal.item.targetWeekId);
  const summary = week && progress ? getWeekProgressSummary(progress, week) : null;
  const complete = isRestaurantComplete(state);
  const owned = SUSHI_CATALOG.filter((item) => state.inventory.includes(item.id)).length;
  const chapterHonors = getChapterHonors(state).filter((honor) => honor.earned).length;
  return html`<aside
    class="sushi-next-goal sushi-companion-goal"
    data-testid="sushi-next-goal"
    aria-label="Dina restaurangmål"
  >
    <div class="sushi-goal-modes" role="group" aria-label="Välj sorts mål">
      <button
        type="button"
        aria-pressed=${mode === 'grow'}
        data-testid="sushi-goal-grow"
        @click=${() => actions.chooseMode('grow')}
      >
        Bygg vidare
      </button>
      <button
        type="button"
        aria-pressed=${mode === 'personalize'}
        data-testid="sushi-goal-personalize"
        @click=${() => actions.chooseMode('personalize')}
      >
        Inred
      </button>
    </div>
    ${
      goal
        ? html`
            <button
              type="button"
              class="sushi-goal-action"
              data-testid="sushi-goal-action"
              @click=${() => (goal.requiresStudy ? actions.study(goal.item.requiredLesson, goal.item.targetWeekId) : actions.openShop(goal.item.id))}
            >
              <span
                class="sushi-atlas-sprite sushi-goal-sprite"
                aria-hidden="true"
                style=${spriteStyle(SUSHI_SPRITES[goal.item.id])}
              ></span>
              <span
                ><strong>${goal.item.name}</strong
                ><small
                  >${goal.unlocked ? `¥ ${yen(goal.item.priceYen)} · Öppna butik` : `Kapitel ${goal.item.requiredLesson} · ${goal.item.requiredTierLabel} (${goal.item.requiredPercent} %)${summary ? ` · ${summary.overallPercent} % klart` : ''}`}</small
                ></span
              >
            </button>
            <details class="sushi-goal-reason">
              <summary>Varför detta mål?</summary>
              <p data-testid="sushi-goal-reason">${goal.reasonSv}</p>
            </details>
          `
        : complete
          ? html`
              <strong class="sushi-goal-finished">Restaurangen är komplett!</strong>
              <p>Alla 21 kursbelöningar är dina.</p>
              <button
                type="button"
                class="sushi-goal-link"
                data-testid="sushi-replay-finale"
                @click=${actions.replayFinale}
              >
                Fira din kursresa ✨
              </button>
              ${mode === 'personalize' ? html`<button type="button" class="sushi-goal-link" @click=${actions.openJournal}>Se frivilliga projekt →</button>` : ''}
            `
          : html`
              <strong class="sushi-goal-finished"
                >${mode === 'grow' ? 'Köket är färdigbyggt!' : 'Menyn och inredningen är samlade!'}</strong
              >
              <button type="button" class="sushi-goal-link" @click=${actions.openJournal}>
                Se kapitelminnen och frivilliga projekt →
              </button>
            `
    }
    <span class="sushi-goal-progress">${owned} / 21 belöningar köpta</span>
    <button
      type="button"
      class="sushi-honors-shortcut"
      data-testid="sushi-honors-shortcut"
      @click=${actions.openJournal}
    >
      🏅 Kapitelminnen ${chapterHonors} / 7
    </button>
  </aside>`;
}

export function renderChapterHonors(
  state: SushiRestaurantState,
  onStudy: (lesson: number, weekId: string) => void,
) {
  const honors = getChapterHonors(state);
  return html`<section
    class="sushi-chapter-honors"
    aria-label="Permanenta kapitelminnen"
    data-testid="sushi-chapter-honors"
  >
    <div class="sushi-companion-section-heading">
      <div>
        <span class="sushi-companion-kicker">Din kursresa</span>
        <h3>En plats för varje guldmedalj</h3>
      </div>
      <strong>${honors.filter((honor) => honor.earned).length} / 7</strong>
    </div>
    <p>
      Guldmedaljerna får ett eget kapitelminne här så fort de är intjänade. Alla får plats, och de
      stannar kvar när du repeterar.
    </p>
    <div class="sushi-honor-grid">
      ${honors.map(
        (honor) =>
          html`<article
            class="sushi-honor ${honor.earned ? 'is-earned' : ''}"
            data-testid=${`sushi-honor-${honor.lessonNumber}`}
            data-earned=${honor.earned}
          >
            <span
              class="sushi-honor-icon ${honor.earned ? 'sushi-atlas-sprite' : ''}"
              aria-hidden="true"
              style=${honor.earned ? spriteStyle(SUSHI_SPRITES[honor.grantId]) : ''}
              >${honor.earned ? '' : '◇'}</span
            >
            <strong>Kapitel ${honor.lessonNumber}</strong
            ><span>${honor.earned ? 'Guld · sparat för alltid' : 'Guld · 100 %'}</span>
            <button type="button" @click=${() => onStudy(honor.lessonNumber, honor.weekId)}>
              ${honor.earned ? 'Repetera' : 'Till kapitlet'} →
            </button>
          </article>`,
      )}
    </div>
    <small
      >Kapitelminnena är dina utmärkelser. Köpta dekorationer kan du fortfarande byta på vägg- och
      golvplatsen.</small
    >
  </section>`;
}

export function renderRestaurantProjects(
  state: SushiRestaurantState,
  busy: boolean,
  buying: string | null,
  error: string | null,
  actions: { buy: (id: string) => void; study: (lesson: number, weekId: string) => void },
) {
  const completed = state.completedProjects ?? [];
  return html`<section
    class="sushi-projects"
    aria-label="Frivilliga restaurangprojekt"
    data-testid="sushi-projects"
  >
    <div class="sushi-companion-section-heading">
      <div>
        <span class="sushi-companion-kicker">Något att spara till</span>
        <h3>Gör plats för dina idéer</h3>
      </div>
      <span>${completed.length} / ${SUSHI_PROJECTS.length}</span>
    </div>
    <p>
      Större, frivilliga projekt som syns i restaurangen. Välj det du tycker om att spara till. De
      ger inga intäktsbonusar och ingår inte i de 21 kursbelöningarna.
    </p>
    <div class="sushi-project-grid">
      ${SUSHI_PROJECTS.map((project) => {
        const done = completed.includes(project.id);
        const { eligible, reason } = projectEligibility(state, project);
        const available = state.balanceUnits >= project.priceUnits;
        const savedPercent = Math.min(
          100,
          Math.floor((state.balanceUnits / project.priceUnits) * 100),
        );
        const week = courseWeeks.find((item) => item.lessonNumber === project.requiredLesson);
        return html`<article
          class="sushi-project-card ${done ? 'is-complete' : ''}"
          data-testid=${`sushi-project-${project.id}`}
        >
          <span class="sushi-project-icon" aria-hidden="true">${project.icon}</span>
          <h4>${project.name}</h4>
          <p>${project.description}</p>
          ${
            done
              ? html`<strong class="sushi-project-done">✓ Byggt · syns i restaurangen</strong>`
              : html`
                  <strong>¥ ${yen(project.priceYen)}</strong>
                  ${eligible ? html`<div class="sushi-project-savings"><progress value=${savedPercent} max="100" aria-label=${`Sparat till ${project.name}`}></progress><small>${savedPercent} % av priset finns i ditt disponibla saldo</small></div>` : html`<small>${reason}</small>`}
                  ${
                    !eligible && week
                      ? html`<button
                          type="button"
                          class="sushi-btn-secondary pixel-btn"
                          @click=${() => actions.study(project.requiredLesson, week.id)}
                        >
                          Öppna Kapitel ${project.requiredLesson} →
                        </button>`
                      : html` <button
                          type="button"
                          class="sushi-btn-buy pixel-btn"
                          data-testid=${`buy-project-${project.id}`}
                          ?disabled=${busy || !available || !eligible}
                          @click=${() => actions.buy(project.id)}
                        >
                          ${buying === project.id ? 'Bygger…' : available ? `Bygg för ¥ ${yen(project.priceYen)}` : `Saknar ¥ ${yen(Math.max(0, project.priceYen - unitsToWholeYen(state.balanceUnits)))}`}
                        </button>`
                  }
                `
          }
        </article>`;
      })}
    </div>
    ${error ? html`<p role="alert" data-testid="sushi-project-error">${error}</p>` : ''}
  </section>`;
}

export function renderRestaurantFinale(onStudies: () => void, onContinue: () => void) {
  return html`<div class="sushi-finale-scrim">
    <section
      class="sushi-finale"
      role="dialog"
      aria-modal="true"
      aria-label="Din restaurang är färdig"
      data-testid="sushi-finale"
      tabindex="-1"
    >
      <div class="sushi-finale-seal" aria-hidden="true">🌸</div>
      <span class="sushi-companion-kicker">Genki I · Kapitel 6–12</span>
      <h2 lang="ja">おめでとう！</h2>
      <h3>Din restaurang är färdig.</h3>
      <p>
        Du har byggt köket, fyllt menyn och samlat alla 21 kursbelöningar. Sju kapitelminnen får nu
        en egen plats i din restaurang.
      </p>
      <div class="sushi-finale-chapters" aria-label="Sju kapitel i mål">
        ${courseWeeks.map((week) => html`<span>🏅 ${week.lessonNumber}</span>`)}
      </div>
      <p class="sushi-finale-note">
        Nu kan du njuta av din restaurang och återvända till studierna. De större
        inredningsprojekten finns kvar som frivilliga sparmål.
      </p>
      <div class="sushi-finale-actions">
        <button
          type="button"
          class="sushi-btn-primary pixel-btn"
          data-testid="sushi-finale-studies"
          @click=${onStudies}
        >
          Tillbaka till studierna →</button
        ><button
          type="button"
          class="sushi-btn-secondary pixel-btn"
          data-testid="sushi-finale-continue"
          @click=${onContinue}
        >
          Stanna i restaurangen
        </button>
      </div>
    </section>
  </div>`;
}
