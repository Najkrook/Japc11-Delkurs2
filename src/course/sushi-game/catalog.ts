/**
 * Master Catalog Domain Engine for Sushi Restaurant Tycoon Game
 * JAPC11 Delkurs 2 Prototype - Milestone 3 (Tickets 06, 07, 08)
 *
 * Defines the canonical catalog schema, master items, typed upgrade effects,
 * lookup functions, and prospective purchase/bottleneck impact calculators.
 */

import {
  YEN_UNIT_MULTIPLIER,
  EXTENDED_CAP_MS,
  MS_PER_HOUR,
} from './types.ts';
import type {
  SushiEconomyState,
  SushiRestaurantState,
  ProductionRate,
} from './types.ts';
import { calculateProductionRate } from './economy.ts';
import type { UnlockGrantId, MedalTier } from './medals.ts';

// ==========================================
// 1. Catalog Types
// ==========================================

export type CatalogCategory = 'kitchen' | 'service' | 'cap' | 'recipe' | 'decoration';

export interface SushiCatalogItem {
  readonly id: UnlockGrantId;
  readonly name: string;
  readonly category: CatalogCategory;
  readonly categoryLabel: string;
  readonly icon: string;
  readonly requiredLesson: number;
  readonly requiredTier: MedalTier;
  readonly requiredTierLabel: string;
  readonly requiredPercent: number;
  readonly targetWeekId: string;
  readonly priceYen: number;
  readonly priceUnits: number; // Exactly priceYen * 60,000
  readonly effectDescription: string;

  // Typed upgrade effects for economy & visual scene
  readonly kitchenCapacityDelta?: number; // e.g. +2 for prep_counter
  readonly serviceCapacityDelta?: number; // e.g. +2 for conveyor_belt
  readonly averageRevenueDelta?: number;  // For future recipe variants
  readonly newCapMs?: number;             // e.g. 43,200,000 ms (12h) for cap_extension_12h
  readonly slotType?: 'wallSlot' | 'floorSlot'; // For M4 decorations
  readonly recipeId?: string;             // For M4 recipes
}

export interface UpgradeStatDeltas {
  readonly kitchenCapacityDelta?: number;
  readonly serviceCapacityDelta?: number;
  readonly averageRevenueDelta?: number;
  readonly newCapMs?: number;
}

export interface ProspectiveRateImpact {
  readonly currentRate: ProductionRate;
  readonly prospectiveRate: ProductionRate;
  readonly ordersDelta: number;
  readonly yenDelta: number;
  readonly newKitchenCapacity: number;
  readonly newServiceCapacity: number;
  readonly newCapMs: number;
  readonly hasImmediateEffect: boolean;
  readonly isBottleneckLimiting: boolean;
  readonly educationalExplanation: string;
}

export type PurchaseFailureReason =
  | 'RESTAURANT_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_LOCKED'
  | 'ALREADY_OWNED'
  | 'INSUFFICIENT_FUNDS';

export interface PurchaseSuccessResult {
  readonly success: true;
  readonly state: SushiRestaurantState;
  readonly restaurant: SushiRestaurantState;
  readonly item: SushiCatalogItem;
  readonly purchasedItem: SushiCatalogItem;
  readonly debitedUnits: number;
  readonly debitedYen: number;
  readonly wasAlreadyProcessed: boolean;
}

export interface PurchaseFailureResult {
  readonly success: false;
  readonly reason: PurchaseFailureReason;
  readonly message: string;
  readonly state?: SushiRestaurantState;
  readonly restaurant?: SushiRestaurantState;
  readonly requiredUnits?: number;
  readonly actualUnits?: number;
  readonly item?: SushiCatalogItem;
  readonly purchasedItem?: SushiCatalogItem;
}

export type PurchaseItemResult = PurchaseSuccessResult | PurchaseFailureResult;

// ==========================================
// 2. Master Catalog Definitions (7 Canonical MVP Items)
// ==========================================

export const SUSHI_CATALOG: readonly SushiCatalogItem[] = [
  {
    id: 'prep_counter',
    name: 'Förbättrad beredningsbänk',
    category: 'kitchen',
    categoryLabel: 'Kök',
    icon: '🔪',
    requiredLesson: 6,
    requiredTier: 'bronze',
    requiredTierLabel: 'Brons',
    requiredPercent: 60,
    priceYen: 300,
    priceUnits: 300 * YEN_UNIT_MULTIPLIER, // 18,000,000
    kitchenCapacityDelta: 2,
    effectDescription: 'Ökar kökskapaciteten med +2 ordrar/minut (från 1 till 3).',
    targetWeekId: 'week-1',
  },
  {
    id: 'salmon_nigiri',
    name: 'Laxnigiri',
    category: 'recipe',
    categoryLabel: 'Recept',
    icon: '🍣',
    requiredLesson: 6,
    requiredTier: 'silver',
    requiredTierLabel: 'Silver',
    requiredPercent: 80,
    priceYen: 600,
    priceUnits: 600 * YEN_UNIT_MULTIPLIER, // 36,000,000
    recipeId: 'salmon_nigiri',
    effectDescription: 'Klassisk menyvariation med färsk lax. Visuell menyförbättring.',
    targetWeekId: 'week-1',
  },
  {
    id: 'paper_lantern',
    name: 'Papperslykta',
    category: 'decoration',
    categoryLabel: 'Dekoration',
    icon: '🏮',
    requiredLesson: 6,
    requiredTier: 'gold',
    requiredTierLabel: 'Guld',
    requiredPercent: 100,
    priceYen: 300,
    priceUnits: 300 * YEN_UNIT_MULTIPLIER, // 18,000,000
    slotType: 'wallSlot',
    effectDescription: 'Traditionell röd papperslykta för restaurangens väggplats.',
    targetWeekId: 'week-1',
  },
  {
    id: 'cap_extension_12h',
    name: 'Längre produktionstid',
    category: 'cap',
    categoryLabel: 'Produktionstid',
    icon: '⏰',
    requiredLesson: 7,
    requiredTier: 'bronze',
    requiredTierLabel: 'Brons',
    requiredPercent: 60,
    priceYen: 1800,
    priceUnits: 1800 * YEN_UNIT_MULTIPLIER, // 108,000,000
    newCapMs: EXTENDED_CAP_MS, // 43,200,000 ms (12 hours)
    effectDescription: 'Höjer intjäningstaket från 8 till 12 sammanhängande timmar.',
    targetWeekId: 'week-2',
  },
  {
    id: 'potted_plant',
    name: 'Krukväxt',
    category: 'decoration',
    categoryLabel: 'Dekoration',
    icon: '🪴',
    requiredLesson: 7,
    requiredTier: 'gold',
    requiredTierLabel: 'Guld',
    requiredPercent: 100,
    priceYen: 450,
    priceUnits: 450 * YEN_UNIT_MULTIPLIER, // 27,000,000
    slotType: 'floorSlot',
    effectDescription: 'Grönskande bonsai och krukväxt för restaurangens golvplats.',
    targetWeekId: 'week-2',
  },
  {
    id: 'conveyor_belt',
    name: 'Transportband',
    category: 'service',
    categoryLabel: 'Service',
    icon: '🔄',
    requiredLesson: 9,
    requiredTier: 'bronze',
    requiredTierLabel: 'Brons',
    requiredPercent: 60,
    priceYen: 3600,
    priceUnits: 3600 * YEN_UNIT_MULTIPLIER, // 216,000,000
    serviceCapacityDelta: 2,
    effectDescription: 'Ökar servicekapaciteten med +2 ordrar/minut (från 2 till 4).',
    targetWeekId: 'week-4',
  },
  {
    id: 'wave_print',
    name: 'Vågmotiv',
    category: 'decoration',
    categoryLabel: 'Dekoration',
    icon: '🌊',
    requiredLesson: 9,
    requiredTier: 'gold',
    requiredTierLabel: 'Guld',
    requiredPercent: 100,
    priceYen: 600,
    priceUnits: 600 * YEN_UNIT_MULTIPLIER, // 36,000,000
    slotType: 'wallSlot',
    effectDescription: 'Konsttryck med ukiyo-e vågmotiv för restaurangens väggplats.',
    targetWeekId: 'week-4',
  },
] as const;

// ==========================================
// 3. Lookup & Helper Utilities
// ==========================================

export function getCatalogItem(itemId: string): SushiCatalogItem | undefined {
  return SUSHI_CATALOG.find((item) => item.id === itemId);
}

export function isCatalogItem(itemId: string): itemId is UnlockGrantId {
  return SUSHI_CATALOG.some((item) => item.id === itemId);
}

// ==========================================
// 4. Prospective Rate & Bottleneck Previews
// ==========================================

/**
 * Computes prospective production rate, stat deltas, bottleneck shift,
 * and educational explanations for an upgrade under consideration.
 */
export function previewUpgradeImpact(
  currentState: SushiEconomyState,
  deltas: UpgradeStatDeltas,
): ProspectiveRateImpact {
  const currentRate = calculateProductionRate(
    currentState.kitchenCapacity,
    currentState.serviceCapacity,
    currentState.averageRevenuePerOrder,
  );

  const newKitchen = currentState.kitchenCapacity + (deltas.kitchenCapacityDelta ?? 0);
  const newService = currentState.serviceCapacity + (deltas.serviceCapacityDelta ?? 0);
  const newAvgRev = currentState.averageRevenuePerOrder + (deltas.averageRevenueDelta ?? 0);
  const newCapMs = deltas.newCapMs ?? currentState.capMs;

  const prospectiveRate = calculateProductionRate(newKitchen, newService, newAvgRev);

  const ordersDelta = prospectiveRate.ordersPerMinute - currentRate.ordersPerMinute;
  const yenDelta = prospectiveRate.yenPerMinute - currentRate.yenPerMinute;
  const hasImmediateEffect =
    yenDelta > 0 || (deltas.newCapMs !== undefined && deltas.newCapMs !== currentState.capMs);

  const isCapacityUpgrade =
    (deltas.kitchenCapacityDelta ?? 0) > 0 || (deltas.serviceCapacityDelta ?? 0) > 0;
  const isBottleneckLimiting = isCapacityUpgrade && yenDelta === 0;

  let educationalExplanation = '';
  if (isBottleneckLimiting) {
    if ((deltas.serviceCapacityDelta ?? 0) > 0 && currentRate.bottleneck === 'kitchen') {
      educationalExplanation =
        `Detta köp ökar servicekapaciteten till ${newService} ordrar/min, men köket producerar bara ${newKitchen} ${
          newKitchen === 1 ? 'order' : 'ordrar'
        }/min. Eftersom intäkten styrs av min(kök, service), förblir intäktstakten ${
          currentRate.yenPerMinute
        } ¥/min tills du uppgraderar köket.`;
    } else if ((deltas.kitchenCapacityDelta ?? 0) > 0 && currentRate.bottleneck === 'service') {
      educationalExplanation =
        `Detta köp ökar kökskapaciteten till ${newKitchen} ordrar/min, men servicen kan bara hantera ${newService} ${
          newService === 1 ? 'order' : 'ordrar'
        }/min. Intäktstakten förblir ${currentRate.yenPerMinute} ¥/min tills du uppgraderar servicen.`;
    }
  } else if (yenDelta > 0) {
    educationalExplanation = `Intäktstakten ökar direkt från ${currentRate.yenPerMinute} till ${prospectiveRate.yenPerMinute} ¥/min (+${yenDelta} ¥/min).`;
  } else if (deltas.newCapMs !== undefined && deltas.newCapMs > currentState.capMs) {
    const extraHours = (deltas.newCapMs - currentState.capMs) / MS_PER_HOUR;
    educationalExplanation = `Förlänger produktionstiden med +${extraHours} timmar (från ${
      currentState.capMs / MS_PER_HOUR
    }h till ${newCapMs / MS_PER_HOUR}h) mellan hämtningar.`;
  }

  return {
    currentRate,
    prospectiveRate,
    ordersDelta,
    yenDelta,
    newKitchenCapacity: newKitchen,
    newServiceCapacity: newService,
    newCapMs,
    hasImmediateEffect,
    isBottleneckLimiting,
    educationalExplanation,
  };
}

/**
 * Previews the effect of purchasing a catalog item for the given restaurant state.
 */
export function previewCatalogPurchase(
  state: SushiEconomyState,
  itemId: string,
): ProspectiveRateImpact | undefined {
  const item = getCatalogItem(itemId);
  if (!item) return undefined;

  const impact = previewUpgradeImpact(state, {
    kitchenCapacityDelta: item.kitchenCapacityDelta,
    serviceCapacityDelta: item.serviceCapacityDelta,
    averageRevenueDelta: item.averageRevenueDelta,
    newCapMs: item.newCapMs,
  });

  if (!impact.educationalExplanation) {
    return {
      ...impact,
      educationalExplanation: item.effectDescription,
    };
  }

  return impact;
}
