import type { RestaurantTier } from './types.ts';

/**
 * Top-left anchors for owned recipe display sprites, in 1536 × 1024 room fractions.
 * The first three dishes can be purchased in tier 1, five in tier 2, and all seven
 * in tier 3. On the expanded rooms the display follows the right-hand return,
 * leaving the conveyor and kitchen work area clear. The two extra tier-2 and four
 * extra tier-1 anchors also keep legacy or test states safe to render.
 */
export const RECIPE_DISPLAY_POSITIONS: Record<
  RestaurantTier,
  readonly (readonly [number, number])[]
> = {
  1: [
    [463 / 900, 324 / 600],
    [499 / 900, 342 / 600],
    [535 / 900, 360 / 600],
    [441 / 900, 313 / 600],
    [419 / 900, 302 / 600],
    [397 / 900, 291 / 600],
    [375 / 900, 280 / 600],
  ],
  2: [
    [535 / 900, 363 / 600],
    [555 / 900, 355 / 600],
    [575 / 900, 347 / 600],
    [595 / 900, 339 / 600],
    [615 / 900, 331 / 600],
    [525 / 900, 377 / 600],
    [545 / 900, 369 / 600],
  ],
  3: [
    [599 / 900, 365 / 600],
    [619 / 900, 357 / 600],
    [639 / 900, 349 / 600],
    [659 / 900, 341 / 600],
    [679 / 900, 333 / 600],
    [699 / 900, 325 / 600],
    [719 / 900, 317 / 600],
  ],
};

/** A 27px sprite in a 900px-wide room; sized for the narrow counter return. */
export const RECIPE_DISPLAY_SIZE = 46;
