import type { RestaurantTier } from './types.ts';

/** All anchors are fractions of the 1536 × 1024 room canvas. */
export type ScenePoint = readonly [number, number];
export type ScenePlacement = readonly [number, number, number];
export type RestaurantProjectId =
  'study_nook' | 'lantern_evening' | 'garden_terrace' | 'hanami_festival';
export interface TierScene {
  tier: RestaurantTier;
  room: string;
  foreground: string;
  floorMaterial: 'wood' | 'tile';
  chef: ScenePlacement;
  guests: readonly ScenePoint[];
  dishes: readonly ScenePoint[];
  recipeDisplays: readonly ScenePoint[];
  steam: ScenePoint;
  beltStart: ScenePoint;
  beltEnd: ScenePoint;
  placements: Record<string, ScenePlacement>;
  projects: Record<RestaurantProjectId, ScenePlacement>;
}

const basePlacements: Record<string, ScenePlacement> = {
  // Keep the purchased workbench beside the chef, with an unobstructed top.
  prep_counter: [0.64, 0.49, 0.12],
  cap_extension_12h: [0.81, 0.43, 0.052],
  precision_knife: [0.52, 0.35, 0.05],
  conveyor_belt: [0.35, 0.43, 0.25],
  service_counter: [0.7, 0.62, 0.13],
  sous_chef: [0.49, 0.34, 0.13],
  // Achievement and interchangeable wall slot must never share a footprint.
  master_license: [0.71, 0.42, 0.075],
  paper_lantern: [0.79, 0.44, 0.08],
  wave_print: [0.79, 0.44, 0.08],
  noren_curtain: [0.14, 0.27, 0.09],
  potted_plant: [0.74, 0.62, 0.085],
  andon_lantern: [0.74, 0.62, 0.085],
  sakura_bonsai: [0.74, 0.62, 0.085],
  golden_maneki_neko: [0.74, 0.62, 0.085],
};
export const RESTAURANT_SCENES: Record<RestaurantTier, TierScene> = {
  1: {
    tier: 1,
    room: '/sprites/sushi/tiers/tier-1.png',
    foreground: '/sprites/sushi/tiers/tier-1-front.png',
    floorMaterial: 'wood',
    chef: [0.43, 0.52, 0.15],
    guests: [
      [0.369, 0.606],
      [0.465, 0.695],
    ],
    dishes: [
      [0.391, 0.5],
      [0.489, 0.58],
    ],
    recipeDisplays: [
      [0.54, 0.55],
      [0.58, 0.58],
      [0.62, 0.61],
      [0.66, 0.64],
      [0.54, 0.48],
      [0.58, 0.51],
      [0.62, 0.54],
    ],
    steam: [0.49, 0.31],
    beltStart: [0.4, 0.49],
    beltEnd: [0.6, 0.65],
    placements: { ...basePlacements },
    projects: {
      study_nook: [0.17, 0.59, 0.15],
      lantern_evening: [0.5, 0.05, 0.27],
      garden_terrace: [0.76, 0.7, 0.15],
      hanami_festival: [0.24, 0.74, 0.21],
    },
  },
  2: {
    tier: 2,
    room: '/sprites/sushi/tiers/tier-2-expanded.png',
    foreground: '/sprites/sushi/tiers/tier-2-expanded-front.png',
    floorMaterial: 'wood',
    chef: [0.455, 0.54, 0.13],
    // The first three existing counter guests; extra seats remain available for later activity.
    guests: [
      [0.329, 0.525],
      [0.391, 0.572],
      [0.456, 0.625],
    ],
    dishes: [
      [0.337, 0.422],
      [0.4, 0.47],
      [0.464, 0.519],
    ],
    recipeDisplays: [
      [0.515, 0.51],
      [0.557, 0.54],
      [0.599, 0.57],
      [0.641, 0.6],
      [0.69, 0.55],
      [0.515, 0.44],
      [0.557, 0.47],
    ],
    steam: [0.475, 0.29],
    beltStart: [0.336, 0.436],
    beltEnd: [0.546, 0.592],
    placements: {
      ...basePlacements,
      prep_counter: [0.64, 0.51, 0.12],
      cap_extension_12h: [0.85, 0.43, 0.05],
      precision_knife: [0.53, 0.35, 0.05],
      conveyor_belt: [0.31, 0.4, 0.28],
      service_counter: [0.67, 0.61, 0.12],
      sous_chef: [0.59, 0.42, 0.11],
      master_license: [0.34, 0.2, 0.055],
      paper_lantern: [0.87, 0.48, 0.07],
      wave_print: [0.87, 0.48, 0.07],
      noren_curtain: [0.13, 0.25, 0.085],
      potted_plant: [0.79, 0.63, 0.09],
      andon_lantern: [0.79, 0.63, 0.09],
      sakura_bonsai: [0.79, 0.63, 0.09],
      golden_maneki_neko: [0.79, 0.63, 0.09],
    },
    projects: {
      study_nook: [0.17, 0.59, 0.15],
      lantern_evening: [0.49, 0.05, 0.27],
      garden_terrace: [0.76, 0.7, 0.15],
      hanami_festival: [0.24, 0.74, 0.21],
    },
  },
  3: {
    tier: 3,
    room: '/sprites/sushi/tiers/tier-3-expanded.png',
    foreground: '/sprites/sushi/tiers/tier-3-expanded-front.png',
    floorMaterial: 'tile',
    chef: [0.47, 0.505, 0.13],
    // Spread the three existing guests across seats one, three and five.
    guests: [
      [0.375, 0.522],
      [0.473, 0.6],
      [0.572, 0.681],
    ],
    dishes: [
      [0.381, 0.42],
      [0.479, 0.498],
      [0.577, 0.58],
    ],
    recipeDisplays: [
      [0.635, 0.46],
      [0.677, 0.49],
      [0.719, 0.52],
      [0.761, 0.55],
      [0.635, 0.53],
      [0.677, 0.56],
      [0.719, 0.59],
    ],
    steam: [0.448, 0.28],
    beltStart: [0.396, 0.434],
    beltEnd: [0.626, 0.602],
    placements: {
      ...basePlacements,
      prep_counter: [0.68, 0.47, 0.11],
      cap_extension_12h: [0.86, 0.35, 0.05],
      precision_knife: [0.55, 0.34, 0.05],
      conveyor_belt: [0.37, 0.39, 0.3],
      service_counter: [0.62, 0.68, 0.12],
      sous_chef: [0.565, 0.38, 0.11],
      master_license: [0.3, 0.24, 0.055],
      paper_lantern: [0.9, 0.51, 0.065],
      wave_print: [0.9, 0.51, 0.065],
      noren_curtain: [0.09, 0.23, 0.085],
      potted_plant: [0.47, 0.67, 0.085],
      andon_lantern: [0.47, 0.67, 0.085],
      sakura_bonsai: [0.47, 0.67, 0.085],
      golden_maneki_neko: [0.47, 0.67, 0.085],
    },
    projects: {
      study_nook: [0.17, 0.43, 0.12],
      lantern_evening: [0.51, 0.06, 0.26],
      garden_terrace: [0.74, 0.73, 0.14],
      hanami_festival: [0.1, 0.68, 0.21],
    },
  },
};
export function tierAssets(tier: RestaurantTier): string[] {
  return [RESTAURANT_SCENES[tier].room, RESTAURANT_SCENES[tier].foreground];
}
