import { html } from 'lit-html';
import type { WeekMedalTier, CourseTemplate } from '../types.ts';
import type { WeekProgressSummary } from '../course-state.ts';

export interface StampConfig {
  tier: NonNullable<WeekMedalTier>;
  titleJp: string;
  subJp: string;
  labelSv: string;
  meaningSv: string;
  rimColor: string;
  glowColor: string;
  badgeEmoji: string;
}

export const STAMP_CONFIGS: Record<NonNullable<WeekMedalTier>, StampConfig> = {
  gold: {
    tier: 'gold',
    titleJp: '大変よくできました',
    subJp: '満点合格 · 免許皆伝',
    labelSv: 'Guldmedalj',
    meaningSv: 'Superbt genomfört! Hela veckans kursmaterial är bemästrat.',
    rimColor: '#e5b839',
    glowColor: 'rgba(229, 184, 57, 0.45)',
    badgeEmoji: '🥇',
  },
  silver: {
    tier: 'silver',
    titleJp: 'よくできました',
    subJp: '優秀 · 合格達成',
    labelSv: 'Silvermedalj',
    meaningSv: 'Mycket väl godkänt! Över 80 % av veckan är avklarad.',
    rimColor: '#c0c8d0',
    glowColor: 'rgba(192, 200, 208, 0.4)',
    badgeEmoji: '🥈',
  },
  bronze: {
    tier: 'bronze',
    titleJp: 'がんばりました',
    subJp: '合格 · 修了',
    labelSv: 'Bronsmedalj',
    meaningSv: 'Väl kämpat! Du har nått godkänd nivå (minst 60 %).',
    rimColor: '#cd7f32',
    glowColor: 'rgba(205, 127, 50, 0.35)',
    badgeEmoji: '🥉',
  },
};

/**
 * Compact stamp icon for the sidebar timeline tab
 */
export function renderMiniStamp(medal: WeekMedalTier): CourseTemplate | string {
  if (!medal) return '';
  const config = STAMP_CONFIGS[medal];
  return html`
    <span
      class="course-mini-stamp ${medal}"
      title="${config.labelSv}: ${config.titleJp}"
      aria-label="${config.labelSv}: ${config.titleJp}"
    >
      <span class="mini-stamp-kanji" lang="ja">
        ${medal === 'gold' ? '大変' : medal === 'silver' ? '良' : '合格'}
      </span>
    </span>
  `;
}

/**
 * Large authentic Japanese teacher seal stamp for the Week Bento Hub
 */
export function renderHubStampBadge(
  summary: WeekProgressSummary,
  weekNumber: number,
  isNewlyAwarded = false,
): CourseTemplate {
  const { medal, overallPercent, nextThresholdPercent } = summary;

  if (!medal) {
    const remainingPct = Math.max(0, 60 - overallPercent);
    return html`
      <div
        class="course-hub-stamp-container empty"
        aria-label="Ingen medaljstämpel uppnådd än för vecka ${weekNumber}. Brons kräver 60 %."
      >
        <div class="course-hanko-seal placeholder" aria-hidden="true">
          <div class="hanko-outer-ring dashed"></div>
          <div class="hanko-inner-ring dashed"></div>
          <div class="hanko-seal-content">
            <span class="hanko-kanji-glyph" lang="ja">未達</span>
            <span class="hanko-sub-text">60 % för Brons</span>
          </div>
        </div>
        <div class="stamp-meta-copy">
          <span class="stamp-tier-badge pending">🥉 Nästa mål: Brons (60 %)</span>
          <p class="stamp-motivation-text">
            Nå 60 % för att föräras med veckans japanska lärarstämpel
            <em>(合格 / がんばりました)</em>. ${remainingPct}% kvar!
          </p>
        </div>
      </div>
    `;
  }

  const config = STAMP_CONFIGS[medal];
  const nextTarget =
    nextThresholdPercent !== null
      ? `Nästa mål: ${nextThresholdPercent === 80 ? '🥈 Silver (80 %)' : '🥇 Guld (100 %)'}`
      : '🎉 Högsta utmärkelsen uppnådd!';

  return html`
    <div
      class="course-hub-stamp-container awarded ${medal} ${isNewlyAwarded ? 'just-awarded' : ''}"
      role="status"
      aria-label="Vecka ${weekNumber}: ${config.labelSv} uppnådd! Japansk lärarstämpel: ${config.titleJp}."
    >
      <div
        class="course-hanko-seal stamp-${medal} ${isNewlyAwarded ? 'imprint-animate' : ''}"
        style="--stamp-rim-color: ${config.rimColor}; --stamp-glow-color: ${config.glowColor};"
        aria-hidden="true"
      >
        <div class="hanko-outer-ring"></div>
        <div class="hanko-inner-ring"></div>

        ${
          medal === 'gold'
            ? html`
                <div class="hanko-sakura-rosette">
                  <span>🌸</span>
                </div>
              `
            : ''
        }

        <div class="hanko-seal-content">
          <span class="hanko-top-kanji" lang="ja">${medal === 'bronze' ? '合 格' : '検 印'}</span>
          <strong class="hanko-main-calligraphy" lang="ja">${config.titleJp}</strong>
          <span class="hanko-sub-seal" lang="ja">${config.subJp}</span>
        </div>
      </div>

      <div class="stamp-meta-copy">
        <div class="stamp-tier-header">
          <span class="stamp-tier-badge ${medal}">
            ${config.badgeEmoji} ${config.labelSv} · ${overallPercent}%
          </span>
          <span class="stamp-next-hint">${nextTarget}</span>
        </div>
        <strong class="stamp-jp-phrase" lang="ja">「${config.titleJp}」</strong>
        <p class="stamp-motivation-text">${config.meaningSv}</p>
      </div>
    </div>
  `;
}
