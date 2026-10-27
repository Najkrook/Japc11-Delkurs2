import { YEN_UNIT_MULTIPLIER, type SushiRestaurantState } from './types.ts';

/** Finite cosmetic savings goals. They never change earnings, medals or study progress. */
export interface SushiRestaurantProject {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceYen: number;
  readonly priceUnits: number;
  readonly requiredGrantId: string;
  readonly requiredLesson: number;
  readonly icon: string;
}

export const SUSHI_PROJECTS: readonly SushiRestaurantProject[] = [
  {
    id: 'study_nook',
    name: 'Läshörna',
    description: 'Ett litet bibliotek i restaurangen där gästerna kan läsa japanska.',
    priceYen: 60_000,
    priceUnits: 60_000 * YEN_UNIT_MULTIPLIER,
    requiredGrantId: 'prep_counter',
    requiredLesson: 6,
    icon: '📚',
  },
  {
    id: 'lantern_evening',
    name: 'Lyktkväll',
    description: 'En permanent rad festlyktor som lyser över dina gäster.',
    priceYen: 180_000,
    priceUnits: 180_000 * YEN_UNIT_MULTIPLIER,
    requiredGrantId: 'precision_knife',
    requiredLesson: 8,
    icon: '🏮',
  },
  {
    id: 'garden_terrace',
    name: 'Japansk trädgård',
    description: 'En grön trädgård runt restaurangen, med stenlyktor och en lugn gång.',
    priceYen: 540_000,
    priceUnits: 540_000 * YEN_UNIT_MULTIPLIER,
    requiredGrantId: 'service_counter',
    requiredLesson: 10,
    icon: '🌿',
  },
  {
    id: 'hanami_festival',
    name: 'Hanamifest',
    description: 'En bestående festplats under körsbärsträden som firar hela kursresan.',
    priceYen: 1_620_000,
    priceUnits: 1_620_000 * YEN_UNIT_MULTIPLIER,
    requiredGrantId: 'master_license',
    requiredLesson: 12,
    icon: '🌸',
  },
];

export function getRestaurantProject(id: string): SushiRestaurantProject | undefined {
  return SUSHI_PROJECTS.find((project) => project.id === id);
}

export function projectEligibility(
  state: SushiRestaurantState,
  project: SushiRestaurantProject,
): { eligible: boolean; reason: string } {
  const eligible = state.permanentGrants.includes(project.requiredGrantId);
  return {
    eligible,
    reason: eligible
      ? 'Frivilligt projekt · endast utseende, inga intäktsbonusar.'
      : `Lås upp bronsbelöningen i kapitel ${project.requiredLesson}.`,
  };
}

export type PurchaseRestaurantProjectFailureReason =
  | 'RESTAURANT_NOT_FOUND'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_LOCKED'
  | 'ALREADY_COMPLETED'
  | 'INSUFFICIENT_FUNDS'
  | 'REQUEST_CONFLICT';

export type PurchaseRestaurantProjectResult =
  | {
      success: true;
      state: SushiRestaurantState;
      project: SushiRestaurantProject;
      wasAlreadyProcessed: boolean;
    }
  | {
      success: false;
      reason: PurchaseRestaurantProjectFailureReason;
      message: string;
      state?: SushiRestaurantState;
    };
