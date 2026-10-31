import { createInitialEconomyState } from '../../src/course/sushi-game/economy.ts';
import type { SushiEconomyState } from '../../src/course/sushi-game/types.ts';

/** Original accounting examples remain useful as explicit 8h/12h fixtures.
 * They test arbitrary-cap invariants, not the current restaurant defaults.
 * Current 24h/48h defaults and prospective migration have their own remedy suite.
 */
export const LEGACY_CAP_MS = 8 * 3_600_000;
export const LEGACY_EXTENDED_CAP_MS = 12 * 3_600_000;
export function createLegacyEconomyState(
  now: number,
  overrides: Partial<SushiEconomyState> = {},
): SushiEconomyState {
  return createInitialEconomyState(now, { capMs: LEGACY_CAP_MS, ...overrides });
}
