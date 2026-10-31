import { svg } from 'lit-html';
import type { RestaurantTier, SushiRestaurantState } from './types.ts';
import type { RestaurantProjectId, ScenePlacement } from './tier-scenes.ts';

/**
 * Project artwork has its own footprint in each renovation. Keeping these
 * anchors separate from catalog slots prevents a project from occupying a
 * guest seat or covering an equipped decoration after the room changes.
 */
const PROJECT_LAYOUTS: Record<RestaurantTier, Record<RestaurantProjectId, ScenePlacement>> = {
  1: {
    study_nook: [0.17, 0.55, 0.15],
    lantern_evening: [0.5, 0.07, 0.24],
    garden_terrace: [0.7, 0.82, 0.14],
    hanami_festival: [0.24, 0.7, 0.21],
  },
  2: {
    study_nook: [0.17, 0.55, 0.15],
    lantern_evening: [0.49, 0.07, 0.24],
    garden_terrace: [0.7, 0.82, 0.14],
    hanami_festival: [0.24, 0.7, 0.21],
  },
  3: {
    study_nook: [0.13, 0.45, 0.1],
    lantern_evening: [0.51, 0.08, 0.23],
    garden_terrace: [0.7, 0.82, 0.14],
    hanami_festival: [0.44, 0.735, 0.21],
  },
};

const PROJECT_ART = [
  { id: 'study_nook', file: 'study-nook' },
  { id: 'lantern_evening', file: 'lantern-evening' },
  { id: 'garden_terrace', file: 'garden-terrace' },
  { id: 'hanami_festival', file: 'hanami-festival-deck' },
] as const;

/** A small stone threshold visually joins the garden to the room's front edge. */
function gardenThreshold() {
  // Coordinates are authored against the 900 × 600 scene preview.
  return svg`<g transform="scale(1.7066666667)" aria-hidden="true">
    <path d="M 630 509 L 644 501 L 681 522 L 667 531 Z" fill="#c8b38a" stroke="#795c3e" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 641 515 L 655 507 M 653 522 L 667 514" fill="none" stroke="#9b8764" stroke-width="1.5"/>
  </g>`;
}

/** A short timber threshold joins the tea deck to the restaurant floor. */
function hanamiThreshold(tier: RestaurantTier) {
  const outline =
    tier === 3
      ? 'M 558 522 L 580 509 L 610 526 L 588 539 Z'
      : 'M 382 505 L 403 492 L 429 507 L 408 520 Z';
  const boards =
    tier === 3
      ? 'M 568 528 L 590 515 M 578 534 L 600 521'
      : 'M 391 510 L 412 497 M 400 515 L 421 502';
  return svg`<g transform="scale(1.7066666667)" aria-hidden="true">
    <path d=${outline} fill="#c88845" stroke="#704328" stroke-width="2" stroke-linejoin="round"/>
    <path d=${boards} fill="none" stroke="#916036" stroke-width="1"/>
  </g>`;
}

/** Render optional cosmetic projects independently from catalog decoration slots. */
export function renderProjectImprovements(state: SushiRestaurantState, tier: RestaurantTier) {
  const built = new Set(state.completedProjects ?? []);
  return PROJECT_ART.filter((project) => built.has(project.id)).map((project) => {
    const [x, y, size] =
      tier === 3 && project.id === 'study_nook' && state.inventory.includes('service_counter')
        ? [0.2, 0.43, 0.1]
        : PROJECT_LAYOUTS[tier][project.id];
    const width = size * 1536;
    return svg`<g data-testid=${`art-project-${project.id}`} aria-hidden="true">
      ${project.id === 'garden_terrace' ? gardenThreshold() : ''}
      ${project.id === 'hanami_festival' ? hanamiThreshold(tier) : ''}
      <image href=${`/sprites/sushi/projects/${project.file}.png`}
        x=${x * 1536} y=${y * 1024} width=${width} height=${(width * 2) / 3}/>
    </g>`;
  });
}
