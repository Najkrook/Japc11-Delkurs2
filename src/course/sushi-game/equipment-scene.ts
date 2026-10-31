import { svg } from 'lit-html';
import type { RestaurantTier } from './types.ts';

/** The starter-room upgrade extends the kitchen beside its existing sink. */
export function renderStarterPrepCabinet(x: number, y: number, width: number) {
  return svg`<svg x=${x} y=${y} width=${width} height=${(width * 920 * 1.28) / 1110}
    viewBox="212 69 1110 920" preserveAspectRatio="none" overflow="hidden" aria-hidden="true">
    <image href="/sprites/sushi/upgrades/tier-1-prep-cabinet.png" width="1536" height="1024"/>
  </svg>`;
}

/** Mirror the isometric host station so its counter faces the entrance. */
export function renderEntranceHostStation(x: number, y: number, width: number) {
  return svg`<g transform=${`translate(${2 * x + width} 0) scale(-1 1)`}>
    <svg x=${x} y=${y} width=${width} height=${(width * 729) / 858}
      viewBox="345 161 858 729" preserveAspectRatio="none" overflow="hidden" aria-hidden="true">
      <image href="/sprites/sushi/upgrades/entrance-host-station.png" width="1536" height="1024"/>
    </svg>
  </g>`;
}

/** A continuous track follows both legs of the tier-three service counter. */
export function renderTierThreeConveyor(x: number, y: number, width: number) {
  return svg`<svg x=${x} y=${y} width=${width} height=${(width * (0.28 * 1024)) / (0.45 * 1536)}
    viewBox="34 114 1485 790" preserveAspectRatio="none" overflow="hidden" aria-hidden="true">
    <image href="/sprites/sushi/upgrades/tier-3-l-conveyor.png" width="1536" height="1024"/>
  </svg>`;
}

/**
 * The expanded kitchens already have built-in cabinetry. Reuse the ingredients
 * and cutting surface from the purchased bench as a worktop upgrade there;
 * the starter room gets its own wall-aligned cabinet.
 */
export function renderExpandedPrepWorktop(
  tier: RestaurantTier,
  x: number,
  y: number,
  width: number,
) {
  if (tier === 1) return null;
  // Tier 2 has an existing counter under the upgrade. Keep the prep objects,
  // but mask away the original cart's legs and worktop so they do not float
  // in front of the built-in cabinetry.
  if (tier === 2) {
    return svg`<svg x=${x} y=${y} width=${width} height=${width * 0.5}
      viewBox="0 25 251 125" overflow="hidden" aria-hidden="true">
      <defs><clipPath id="sushi-tier-2-prep-mask" clipPathUnits="userSpaceOnUse">
        <path d="M 33 66 L 72 44 L 110 58 L 111 81 L 66 97 L 33 82 Z M 76 99 L 119 76 L 196 113 L 196 130 L 157 146 L 76 112 Z M 153 68 L 171 55 L 191 64 L 190 78 L 207 76 L 218 91 L 215 100 L 232 99 L 245 107 L 244 126 L 226 130 L 209 123 L 193 119 L 180 109 L 155 100 Z"/>
      </clipPath></defs>
      <image href="/sprites/sushi/tycoon-atlas.png" width="1254" height="1254" clip-path="url(#sushi-tier-2-prep-mask)"/>
    </svg>`;
  }
  return svg`<svg x=${x} y=${y} width=${width} height=${width * 0.5}
    viewBox="0 25 251 125" overflow="hidden" aria-hidden="true">
    <image href="/sprites/sushi/tycoon-atlas.png" width="1254" height="1254"/>
  </svg>`;
}
