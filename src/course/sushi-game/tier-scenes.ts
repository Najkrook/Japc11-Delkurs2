import type { RestaurantTier } from './types.ts';

/** All anchors are fractions of the 1536 × 1024 room canvas. */
export type ScenePoint = readonly [number, number];
export type ScenePlacement = readonly [number, number, number];
export interface TierScene {
  tier: RestaurantTier;
  room: string;
  foreground: string;
  chef: ScenePlacement;
  guests: readonly ScenePoint[];
  dishes: readonly ScenePoint[];
  steam: ScenePoint;
  beltStart: ScenePoint;
  beltEnd: ScenePoint;
  placements: Record<string, ScenePlacement>;
  projectOffset: ScenePoint;
}

const basePlacements: Record<string, ScenePlacement> = {
  prep_counter: [0.4, 0.39, 0.1],
  cap_extension_12h: [0.81, 0.43, 0.045],
  precision_knife: [0.48, 0.45, 0.05],
  conveyor_belt: [0.35, 0.43, 0.25],
  service_counter: [0.7, 0.62, 0.13],
  sous_chef: [0.49, 0.34, 0.13],
  // Achievement and interchangeable wall slot must never share a footprint.
  master_license: [0.71, 0.42, 0.075],
  paper_lantern: [0.79, 0.44, 0.08],
  wave_print: [0.79, 0.44, 0.08],
  noren_curtain: [0.79, 0.44, 0.08],
  potted_plant: [0.82, 0.64, 0.1],
  andon_lantern: [0.82, 0.64, 0.1],
  sakura_bonsai: [0.82, 0.64, 0.1],
  golden_maneki_neko: [0.82, 0.64, 0.1],
};
export const RESTAURANT_SCENES: Record<RestaurantTier, TierScene> = {
  1: {
    tier: 1,
    room: '/sprites/sushi/tiers/tier-1.png',
    foreground: '/sprites/sushi/tiers/tier-1-front.png',
    chef: [0.43, 0.52, 0.15],
    guests: [
      [0.369, 0.606],
      [0.465, 0.695],
    ],
    dishes: [
      [0.391, 0.5],
      [0.489, 0.58],
    ],
    steam: [0.49, 0.31],
    beltStart: [0.4, 0.49],
    beltEnd: [0.6, 0.65],
    placements: { ...basePlacements, prep_counter: [0.4, 0.375, 0.1] },
    projectOffset: [0, 0],
  },
  2: {
    tier: 2,
    room: '/sprites/sushi/tiers/tier-2.png',
    foreground: '/sprites/sushi/tiers/tier-2-front.png',
    chef: [0.43, 0.52, 0.15],
    guests: [
      [0.346, 0.573],
      [0.429, 0.633],
      [0.51, 0.695],
    ],
    dishes: [
      [0.369, 0.475],
      [0.452, 0.535],
      [0.533, 0.595],
    ],
    steam: [0.49, 0.31],
    beltStart: [0.37, 0.46],
    beltEnd: [0.56, 0.6],
    placements: { ...basePlacements },
    projectOffset: [0, 0],
  },
  3: {
    tier: 3,
    room: '/sprites/sushi/tiers/tier-3.png',
    foreground: '/sprites/sushi/tiers/tier-3-front.png',
    chef: [0.425, 0.52, 0.15],
    guests: [
      [0.346, 0.573],
      [0.429, 0.633],
      [0.51, 0.695],
    ],
    dishes: [
      [0.369, 0.475],
      [0.452, 0.535],
      [0.533, 0.595],
    ],
    steam: [0.49, 0.31],
    beltStart: [0.37, 0.46],
    beltEnd: [0.56, 0.6],
    placements: { ...basePlacements, sous_chef: [0.5, 0.35, 0.13] },
    projectOffset: [0, 0],
  },
};
export function tierAssets(tier: RestaurantTier): string[] {
  return [RESTAURANT_SCENES[tier].room, RESTAURANT_SCENES[tier].foreground];
}
