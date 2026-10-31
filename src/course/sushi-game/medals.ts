/**
 * Medal Progression & Permanent Grants Mapping Engine
 * JAPC11 Delkurs 2 Prototype - Milestone 2 (Ticket 05)
 *
 * Maps Genki chapter study medals (Chapters 6–12) into permanent restaurant
 * catalog purchase eligibility grants with strict monotonic non-revocation.
 */

import type { CourseProgressData, CourseWeek, WeekMedalTier } from '../types.ts';
import { courseWeeks } from '../data/index.ts';
import { getWeekProgressSummary } from '../course-state.ts';

// ==========================================
// 1. Grant Identifiers & Types
// ==========================================

export type UnlockGrantId =
  | 'prep_counter'
  | 'salmon_nigiri'
  | 'paper_lantern'
  | 'cap_extension_12h'
  | 'kappamaki'
  | 'potted_plant'
  | 'precision_knife'
  | 'maguro_nigiri'
  | 'noren_curtain'
  | 'conveyor_belt'
  | 'ebi_nigiri'
  | 'wave_print'
  | 'service_counter'
  | 'tamago_nigiri'
  | 'andon_lantern'
  | 'sous_chef'
  | 'sashimi_plate'
  | 'sakura_bonsai'
  | 'master_license'
  | 'omakase_menu'
  | 'golden_maneki_neko';

export type MedalTier = 'bronze' | 'silver' | 'gold';

export interface MedalGrantRule {
  readonly grantId: UnlockGrantId;
  readonly lessonNumber: number;
  readonly requiredTier: MedalTier;
}

export type { SushiCatalogItem, SushiCatalogItem as SushiUnlockCatalogItem } from './catalog.ts';

// ==========================================
// 2. Canonical 21-Item Master Medal Grant Rules (Genki I Chapters 6–12)
// ==========================================

export const MEDAL_GRANT_RULES: readonly MedalGrantRule[] = [
  // Chapter 6 (week-1)
  { grantId: 'prep_counter', lessonNumber: 6, requiredTier: 'bronze' },
  { grantId: 'salmon_nigiri', lessonNumber: 6, requiredTier: 'silver' },
  { grantId: 'paper_lantern', lessonNumber: 6, requiredTier: 'gold' },

  // Chapter 7 (week-2)
  { grantId: 'cap_extension_12h', lessonNumber: 7, requiredTier: 'bronze' },
  { grantId: 'kappamaki', lessonNumber: 7, requiredTier: 'silver' },
  { grantId: 'potted_plant', lessonNumber: 7, requiredTier: 'gold' },

  // Chapter 8 (week-3)
  { grantId: 'precision_knife', lessonNumber: 8, requiredTier: 'bronze' },
  { grantId: 'maguro_nigiri', lessonNumber: 8, requiredTier: 'silver' },
  { grantId: 'noren_curtain', lessonNumber: 8, requiredTier: 'gold' },

  // Chapter 9 (week-4)
  { grantId: 'conveyor_belt', lessonNumber: 9, requiredTier: 'bronze' },
  { grantId: 'ebi_nigiri', lessonNumber: 9, requiredTier: 'silver' },
  { grantId: 'wave_print', lessonNumber: 9, requiredTier: 'gold' },

  // Chapter 10 (week-5)
  { grantId: 'service_counter', lessonNumber: 10, requiredTier: 'bronze' },
  { grantId: 'tamago_nigiri', lessonNumber: 10, requiredTier: 'silver' },
  { grantId: 'andon_lantern', lessonNumber: 10, requiredTier: 'gold' },

  // Chapter 11 (week-6)
  { grantId: 'sous_chef', lessonNumber: 11, requiredTier: 'bronze' },
  { grantId: 'sashimi_plate', lessonNumber: 11, requiredTier: 'silver' },
  { grantId: 'sakura_bonsai', lessonNumber: 11, requiredTier: 'gold' },

  // Chapter 12 (week-7)
  { grantId: 'master_license', lessonNumber: 12, requiredTier: 'bronze' },
  { grantId: 'omakase_menu', lessonNumber: 12, requiredTier: 'silver' },
  { grantId: 'golden_maneki_neko', lessonNumber: 12, requiredTier: 'gold' },
] as const;

// ==========================================
// 3. Master Unlock Catalog Definitions (Re-exported for backward compatibility)
// ==========================================

export { SUSHI_CATALOG, SUSHI_CATALOG as SUSHI_UNLOCK_CATALOG } from './catalog.ts';

// ==========================================
// 4. Pure Functional Evaluation
// ==========================================

const TIER_RANK: Record<MedalTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

/**
 * Checks whether an achieved medal tier satisfies the required tier.
 * Higher tiers satisfy lower tiers (gold satisfies gold, silver, bronze).
 */
export function tierSatisfies(
  achieved: WeekMedalTier | null | undefined,
  required: MedalTier,
): boolean {
  if (!achieved) return false;
  return (TIER_RANK[achieved] ?? 0) >= (TIER_RANK[required] ?? 0);
}

/**
 * Pure function: Evaluates current course progress against canonical medal grant rules.
 * Strictly maps Genki chapters by `lessonNumber` (e.g. Chapter 9 is `week-4`).
 *
 * @param courseState Student's current course progress snapshot
 * @param weeks Course curriculum weeks (defaults to courseWeeks)
 * @returns Array of earned UnlockGrantId strings in canonical order
 */
export function evaluateMedalGrants(
  courseState: CourseProgressData | null | undefined,
  weeks: readonly CourseWeek[] = courseWeeks,
): UnlockGrantId[] {
  if (!courseState || !weeks || weeks.length === 0) {
    return [];
  }

  // Index weeks strictly by lessonNumber
  const weekByLesson = new Map<number, CourseWeek>();
  for (const week of weeks) {
    if (week && typeof week.lessonNumber === 'number') {
      weekByLesson.set(week.lessonNumber, week);
    }
  }

  // Cache medal evaluation per lessonNumber
  const medalByLesson = new Map<number, WeekMedalTier>();
  const earnedGrants: UnlockGrantId[] = [];

  for (const rule of MEDAL_GRANT_RULES) {
    let medal = medalByLesson.get(rule.lessonNumber);
    if (medal === undefined) {
      const week = weekByLesson.get(rule.lessonNumber);
      if (!week) {
        medalByLesson.set(rule.lessonNumber, null);
        continue;
      }
      const summary = getWeekProgressSummary(courseState, week);
      medal = summary.medal;
      medalByLesson.set(rule.lessonNumber, medal);
    }

    if (tierSatisfies(medal, rule.requiredTier)) {
      earnedGrants.push(rule.grantId);
    }
  }

  return earnedGrants;
}

/**
 * Strictly monotonic set union:
 * Merges newly earned grants with existing grants on the restaurant state.
 * Grants once earned are NEVER removed or revoked.
 *
 * @param existingGrants Currently stored grants on the restaurant
 * @param newGrants Newly derived grants
 * @returns Deduplicated array containing all existing and new grants
 */
export function mergePermanentGrants(
  existingGrants: readonly string[] = [],
  newGrants: readonly string[] = [],
): string[] {
  const merged = new Set<string>();

  if (Array.isArray(existingGrants)) {
    for (const g of existingGrants) {
      if (typeof g === 'string') {
        const trimmed = g.trim();
        if (trimmed.length > 0) {
          merged.add(trimmed);
        }
      }
    }
  }

  if (Array.isArray(newGrants)) {
    for (const g of newGrants) {
      if (typeof g === 'string') {
        const trimmed = g.trim();
        if (trimmed.length > 0) {
          merged.add(trimmed);
        }
      }
    }
  }

  return Array.from(merged);
}
