import type { RestaurantTier, SushiRestaurantState } from './types.ts';
import { YEN_UNIT_MULTIPLIER } from './types.ts';
import { getCatalogItem } from './catalog.ts';

export const RESTAURANT_TIER_NAMES = {
  1: 'Den lilla sushibaren',
  2: 'En etablerad sushibar',
  3: 'Mästarens restaurang',
} as const;

export interface RestaurantRenovation {
  targetTier: 2 | 3;
  chapter: number;
  bronzeGrant: string;
  priceYen: number;
  priceUnits: number;
  name: string;
  chapters: string;
  image: string;
}

export const RESTAURANT_RENOVATIONS: readonly RestaurantRenovation[] = [
  {
    targetTier: 2,
    chapter: 9,
    bronzeGrant: 'conveyor_belt',
    priceYen: 3600,
    priceUnits: 3600 * YEN_UNIT_MULTIPLIER,
    name: RESTAURANT_TIER_NAMES[2],
    chapters: '9–10',
    image: '/sprites/sushi/tiers/tier-2-expanded.png',
  },
  {
    targetTier: 3,
    chapter: 11,
    bronzeGrant: 'sous_chef',
    priceYen: 10800,
    priceUnits: 10800 * YEN_UNIT_MULTIPLIER,
    name: RESTAURANT_TIER_NAMES[3],
    chapters: '11–12',
    image: '/sprites/sushi/tiers/tier-3-expanded-no-bench.png',
  },
];

export function tierForChapter(chapter: number): RestaurantTier {
  return chapter >= 11 ? 3 : chapter >= 9 ? 2 : 1;
}

/** Legacy inventory is evidence of purchases; medals alone never grant renovations. */
export function migrateRestaurantTier(state: SushiRestaurantState): SushiRestaurantState {
  if (state.schemaVersion >= 2 && [1, 2, 3].includes(state.restaurantTier)) return state;
  const tier = state.inventory.reduce<RestaurantTier>((highest, id) => {
    const item = getCatalogItem(id);
    // Older saves could buy the belt in tier 2. Its new tier-3 requirement
    // must not retroactively grant a free final renovation.
    const purchaseTier = id === 'conveyor_belt' ? 2 : item?.requiredRestaurantTier;
    return purchaseTier ? (Math.max(highest, purchaseTier) as RestaurantTier) : highest;
  }, 1);
  return { ...state, schemaVersion: 2, restaurantTier: tier };
}

export function currentRestaurantTier(state: SushiRestaurantState): RestaurantTier {
  return migrateRestaurantTier(state).restaurantTier;
}

export function nextRenovation(state: SushiRestaurantState) {
  return RESTAURANT_RENOVATIONS.find((r) => r.targetTier === currentRestaurantTier(state) + 1);
}

export type RenovationFailure =
  | 'RESTAURANT_NOT_FOUND'
  | 'INVALID_TARGET'
  | 'PREVIOUS_TIER_REQUIRED'
  | 'MEDAL_REQUIRED'
  | 'INSUFFICIENT_FUNDS'
  | 'REQUEST_CONFLICT';
export type RenovationResult =
  | { success: true; state: SushiRestaurantState; wasAlreadyProcessed: boolean }
  | { success: false; reason: RenovationFailure; message: string; state?: SushiRestaurantState };
