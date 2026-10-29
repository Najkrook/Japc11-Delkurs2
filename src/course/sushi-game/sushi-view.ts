import { nextRenovation, currentRestaurantTier, RESTAURANT_TIER_NAMES } from './renovations.ts';
import { tierAssets } from './tier-scenes.ts';
import type { RestaurantTier } from './types.ts';
import { renderRenovationCard } from './renovation-view.ts';
import { html, svg, type TemplateResult } from 'lit-html';
import {
  renderRestaurantScene,
  SUSHI_SPRITES,
  spriteStyle,
  type RestaurantSceneArrival,
} from './restaurant-scene.ts';
import type { CourseHostContext, CourseProgressData } from '../types.ts';
import { courseWeeks } from '../data/index.ts';
import { calculateProductionRate, unitsToWholeYen } from './economy.ts';
import { evaluateMedalGrants } from './medals.ts';
import {
  SUSHI_CATALOG,
  SUSHI_CATALOG as SUSHI_UNLOCK_CATALOG,
  getCatalogItem,
  previewCatalogPurchase,
} from './catalog.ts';
import type { SushiRestaurantState, ProductionRate, DecorationSlot } from './types.ts';
import { DEFAULT_CAP_MS, EXTENDED_CAP_MS } from './types.ts';
import { getGuestStudyDeck } from './study-companion.ts';
import { getRestaurantProject } from './projects.ts';
import {
  isRestaurantComplete,
  renderCompanionGoal,
  renderChapterHonors,
  renderRestaurantProjects,
  renderRestaurantFinale,
  type SushiGoalMode,
} from './companion-view.ts';
import {
  getOrInitRestaurant,
  collectRevenue,
  syncMedalGrants,
  purchaseCatalogItem,
  renovateRestaurant,
  equipDecoration,
  purchaseRestaurantProject,
} from './service.ts';
import { isLocalhost } from './config.ts';

const MENU_SECTIONS = [
  { id: 'decoration', label: 'Inredning' },
  { id: 'menu', label: 'Meny' },
  { id: 'projects', label: 'Projekt' },
  { id: 'memories', label: 'Minnen' },
] as const;
type MenuSection = (typeof MENU_SECTIONS)[number]['id'];

/**
 * 24x24 Pixel Art SVG icons matching the pixelarticons package.
 */
export function renderPixelIcon(
  name: 'arrow-left' | 'store' | 'menu' | 'coins' | 'close' | 'check' | 'sun' | 'moon',
): TemplateResult {
  switch (name) {
    case 'arrow-left':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M20 11v2H4v-2zM8 13v2H6v-2zm2 2v2H8v-2zm2 2v2h-2v-2zm-4-6V9H6v2z"/><path d="M10 15V7H8v8zm2 2V5h-2v12z"/></svg>`;
    case 'store':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M3 13h2v8H3zm2 8h14v2H5zm14-8h2v8h-2zm-9-2h4v2h-4zm4-2h4v2h-4zm4 2h4v2h-4zM6 9h4v2H6zm-4 2h4v2H2zM0 7h2v4H0zm2-2h2v2H2zm18 0h2v2h-2zm2 2h2v4h-2zM4 3h16v2H4zm6 12h4v2h-4zm-2 2h2v4H8zm6 0h2v4h-2z"/></svg>`;
    case 'menu':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M20 18H4v-2h16v2Zm0-5H4v-2h16v2Zm0-5H4V6h16v2Z"/></svg>`;
    case 'coins':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M6 2h6v2H6zM4 4h2v2H4zm8 0h2v2h-2zm-8 8h2v2H4zm8 0h2v2h-2zm-6 2h6v2H6zM2 6h2v6H2zm12 0h2v6h-2z"/><path d="M14 8h4v2h-4zm-4 10h2v2h-2zm8-8h2v2h-2zm-6 10h2v2h-2zm6-2h2v2h-2z"/><path d="M12 20h6v2h-6zm-4-6h2v4H8zm12-2h2v6h-2zM7 6h4v2H7z"/><path d="M9 6h2v6H9zm6 8h2v4h-2zm-1-2h3v2h-3z"/></svg>`;
    case 'close':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z"/></svg>`;
    case 'check':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M10 18H8v-2h2v2Zm-2-2H6v-2h2v2Zm4-2v2h-2v-2h2Zm-6 0H4v-2h2v2Zm8 0h-2v-2h2v2Zm2-2h-2v-2h2v2Zm2-2h-2V8h2v2Zm2-2h-2V6h2v2Z"/></svg>`;
    case 'sun':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M11 1h2v3h-2zm0 19h2v3h-2zM3 11h3v2H3zm15 0h3v2h-3zM5 5h2v2H5zm12 12h2v2h-2zM5 19h2v-2H5zm12-12h2v-2h-2zM8 8h8v8H8z"/></svg>`;
    case 'moon':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M14 2h2v2h-2zm-4 4h4v2h-4zm0 12h4v2h-4zm4 2h2v2h-2zm-6-4h2v2H8zm0-8h2v2H8zm-2 2h2v4H6zm0 0H4v2h2zm10-6h2v2h-2zm0 10h2v2h-2z"/></svg>`;
  }
}

if (typeof window !== 'undefined') {
  try {
    // @ts-expect-error Dynamic CSS import is handled by Vite for lazy bundling
    void import('./sushi.css').catch(() => {});
  } catch {}
}

/**
 * Kontrollerar om den aktuella användaren är en fullvärdig autentiserad Google-användare.
 * Anonyma eller saknade sessioner får ingen tillgång till restaurangen.
 */
function isAuthenticatedGoogleUser(
  user: CourseHostContext['user'],
): user is NonNullable<CourseHostContext['user']> {
  if (!user || !user.uid) return false;
  const rawUser = user as { isAnonymous?: boolean };
  return rawUser.isAnonymous !== true;
}

async function waitForStudySync(host: CourseHostContext | null, uid: string): Promise<void> {
  if (!host?.ensureCourseSynced) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      host.ensureCourseSynced(uid),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Study sync timed out')), 15_000);
      }),
    ]);
  } catch (err) {
    if (isLocalhost()) {
      // I lokal miljö utan molnemulator fortsätter vi med lokala kursframsteg
      return;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Controller class managing the client lifecycle, real-time ticker,
 * visibility throttling, and manual revenue collection.
 */
export class SushiClientController {
  public greetingIndex = -1;
  public guestMode: 'welcome' | 'study' = 'welcome';
  public guestLessonNumber = 6;
  public guestAnswerRevealed = false;
  public goalMode: SushiGoalMode = 'grow';
  public showFinale = false;
  public buildingProjectId: string | null = null;
  public projectError: string | null = null;
  private projectKeys = new Map<string, string>();
  public speechError = '';
  public rewardMessage = '';
  public sceneArrival: RestaurantSceneArrival | null = null;
  public purchasedItemId: string | null = null;
  public showingPurchase = false;
  public menuSection: MenuSection = 'decoration';
  private rewardTimer: ReturnType<typeof setTimeout> | null = null;
  public greet(): void {
    const length =
      this.guestMode === 'study' ? getGuestStudyDeck(this.guestLessonNumber).length : 3;
    this.greetingIndex = length ? (this.greetingIndex + 1) % length : -1;
    this.guestAnswerRevealed = false;
    this.speechError = '';
    this.host?.render();
  }
  public dismissGreeting(): void {
    this.greetingIndex = -1;
    this.speechError = '';
    this.host?.render();
  }
  public practiceGuestChapter(lesson = this.guestLessonNumber): void {
    if (!getGuestStudyDeck(lesson).length) return;
    this.guestLessonNumber = lesson;
    this.guestMode = 'study';
    this.greetingIndex = 0;
    this.guestAnswerRevealed = false;
    this.speechError = '';
    this.host?.render();
  }
  public revealGuestAnswer(): void {
    this.guestAnswerRevealed = true;
    this.host?.render();
  }
  public chooseGoal(mode: SushiGoalMode): void {
    this.goalMode = mode;
    this.host?.render();
  }
  public openJournal(): void {
    this.greetingIndex = -1;
    this.previewDecorationId = null;
    this.activeOverlay = 'menu';
    this.showingPurchase = false;
    this.setMenuSection('memories', true);
  }
  public setMenuSection(section: MenuSection, focus = false): void {
    this.menuSection = section;
    this.host?.render();
    if (typeof document !== 'undefined') {
      const panel = document.querySelector<HTMLElement>(
        '[data-testid="sushi-scene-placeholder"] .sushi-overlay-scroll-body',
      );
      if (panel) panel.scrollTop = 0;
      if (focus) document.getElementById(`sushi-menu-tab-${section}`)?.focus();
    }
  }
  public showPurchase(): void {
    const item = getCatalogItem(this.purchasedItemId ?? '');
    if (!item || !this.state?.inventory.includes(item.id)) return;
    if (item.category === 'decoration') {
      this.previewDecoration(item.id);
      return;
    }
    this.activeOverlay = null;
    this.greetingIndex = -1;
    this.showingPurchase = true;
    if (this.rewardTimer) clearTimeout(this.rewardTimer);
    this.rewardTimer = null;
    this.rewardMessage = '';
    this.markSceneArrival(item.id);
    this.host?.render();
    if (typeof document !== 'undefined')
      document.querySelector<HTMLElement>('[data-testid="sushi-purchase-view"]')?.focus();
  }
  public closePurchase(returnToShop = false): void {
    this.showingPurchase = false;
    this.activeOverlay = returnToShop ? 'shop' : null;
    this.host?.render();
    if (typeof document !== 'undefined')
      document
        .querySelector<HTMLElement>(
          returnToShop ? '[data-testid="sushi-see-purchase"]' : '[data-testid="sushi-toggle-shop"]',
        )
        ?.focus();
  }
  public openFinale(): void {
    if (!this.state || !isRestaurantComplete(this.state)) return;
    this.showFinale = true;
    this.activeOverlay = null;
    this.greetingIndex = -1;
    this.host?.render();
    this.focusFinale();
  }
  private focusFinale(): void {
    queueMicrotask(() => {
      if (this.showFinale && typeof document !== 'undefined')
        document.querySelector<HTMLElement>('[data-testid="sushi-finale"]')?.focus();
    });
  }
  public dismissFinale(): void {
    this.showFinale = false;
    if (this.uid && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`japc11-sushi-finale-seen-${this.uid}`, 'true');
      } catch {}
    }
    this.host?.render();
    if (typeof document !== 'undefined')
      document.querySelector<HTMLElement>('[data-testid="sushi-replay-finale"]')?.focus();
  }
  private checkCompletion(): void {
    if (!this.state || !isRestaurantComplete(this.state)) return;
    let seen = false;
    if (this.uid && typeof window !== 'undefined') {
      try {
        seen = window.localStorage.getItem(`japc11-sushi-finale-seen-${this.uid}`) === 'true';
      } catch {}
    }
    if (!seen) {
      this.showFinale = true;
      this.activeOverlay = null;
      this.recentlyUnlocked = [];
      this.greetingIndex = -1;
      this.focusFinale();
    }
  }
  public speakPhrase(text: string, button?: HTMLElement): void {
    const result = this.host?.speak(text, button);
    this.speechError =
      result === 'unsupported'
        ? 'Uttal stöds inte i din webbläsare.'
        : result === 'no-voice'
          ? 'Din enhet saknar en japansk talsyntesröst.'
          : '';
    this.host?.render();
  }
  private celebrate(message: string): void {
    if (this.rewardTimer) clearTimeout(this.rewardTimer);
    this.rewardMessage = message;
    this.rewardTimer = setTimeout(() => {
      this.rewardMessage = '';
      this.rewardTimer = null;
      this.host?.render();
    }, 3200);
    if (typeof this.rewardTimer === 'object' && 'unref' in this.rewardTimer)
      this.rewardTimer.unref();
  }

  private markSceneArrival(itemId: string): void {
    this.sceneArrival = { itemId, sequence: (this.sceneArrival?.sequence ?? 0) + 1 };
  }
  public isEquipping = false;
  public equipError: string | null = null;
  private equipRequest: { slot: string; itemId: string | null; key: string } | null = null;
  public uid: string | null = null;
  public state: SushiRestaurantState | null = null;
  public loading: boolean = false;
  public error: string | null = null;
  public isCollecting: boolean = false;
  public isBuying: string | null = null;
  public buyError: string | null = null;
  public announcement: string = '';
  public recentlyUnlocked: string[] = [];
  public clientReceivedAtMs: number = Date.now();
  public activeOverlay: 'shop' | 'menu' | null = null;
  public shopCategoryFilter: string = 'all';
  public preview:
    { kind: 'decoration'; itemId: string } | { kind: 'renovation'; tier: RestaurantTier } | null =
    null;
  public get previewDecorationId(): string | null {
    return this.preview?.kind === 'decoration' ? this.preview.itemId : null;
  }
  public set previewDecorationId(value: string | null) {
    this.preview = value ? { kind: 'decoration', itemId: value } : null;
  }
  public get previewTier(): RestaurantTier | null {
    return this.preview?.kind === 'renovation' ? this.preview.tier : null;
  }
  public sceneTier: RestaurantTier | null = null;
  public sceneAssetError = '';
  public sceneTransition = 0;
  private roomLoads = new Map<number, Promise<void>>();
  private renovationKeys = new Map<number, string>();

  private decodeTier(tier: RestaurantTier): Promise<void> {
    let pending = this.roomLoads.get(tier);
    if (!pending) {
      pending =
        typeof Image === 'undefined'
          ? Promise.resolve()
          : Promise.all(
              tierAssets(tier).map((src) => {
                const image = new Image();
                image.src = src;
                return image.decode();
              }),
            ).then(() => {});
      this.roomLoads.set(tier, pending);
      // Keep failures cached too: income ticks must not retry network requests.
      void pending.catch(() => {});
    }
    return pending;
  }
  public preloadRenovation(): void {
    const next = this.state && nextRenovation(this.state);
    if (next && this.state?.permanentGrants.includes(next.bronzeGrant))
      void this.decodeTier(next.targetTier).catch(() => {});
  }
  public async showPurchasedRoom(retry = false): Promise<void> {
    if (!this.state) return;
    const tier = currentRestaurantTier(this.state),
      generation = this.generation;
    if (retry) this.roomLoads.delete(tier);
    try {
      await this.decodeTier(tier);
      if (generation !== this.generation) return;
      if (this.sceneTier !== tier) {
        this.sceneTier = tier;
        this.sceneTransition++;
      }
      this.sceneAssetError = '';
    } catch {
      if (generation === this.generation)
        this.sceneAssetError =
          'Renoveringen är köpt, men bilden kunde inte laddas. Försök ladda bilden igen.';
    }
    if (generation === this.generation) this.host?.render();
  }
  public previewRenovation(): void {
    const next = this.state && nextRenovation(this.state);
    if (!next || this.isBuying || this.isEquipping || this.isCollecting) return;
    this.preview = { kind: 'renovation', tier: next.targetTier };
    this.activeOverlay = null;
    this.greetingIndex = -1;
    this.sceneArrival = null;
    this.host?.render();
    if (typeof document !== 'undefined')
      queueMicrotask(() =>
        document.querySelector<HTMLElement>('[data-testid="sushi-renovation-preview"]')?.focus(),
      );
  }
  public closeRenovationPreview(): void {
    this.preview = null;
    this.activeOverlay = 'shop';
    this.host?.render();
    if (typeof document !== 'undefined')
      queueMicrotask(() =>
        document.querySelector<HTMLElement>('[data-testid="preview-renovation"]')?.focus(),
      );
  }
  public async renovate(): Promise<void> {
    if (
      !this.uid ||
      !this.state ||
      this.isBuying ||
      this.isCollecting ||
      this.isEquipping ||
      this.syncing
    )
      return;
    const renovation = nextRenovation(this.state);
    if (!renovation) return;
    const uid = this.uid,
      generation = this.generation;
    const key =
      this.renovationKeys.get(renovation.targetTier) ??
      `renovate_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.renovationKeys.set(renovation.targetTier, key);
    this.sceneTier ??= currentRestaurantTier(this.state);
    this.isBuying = 'renovation';
    this.buyError = null;
    this.host?.render();
    try {
      const result = await renovateRestaurant(uid, renovation.targetTier, key);
      if (this.uid !== uid || this.generation !== generation) return;
      this.renovationKeys.delete(renovation.targetTier);
      if (result.state) {
        this.state = result.state;
        this.clientReceivedAtMs = Date.now();
      }
      if (result.success) {
        this.preview = null;
        this.activeOverlay = null;
        this.announcement = `Renoveringen är klar! Restaurangnivå ${result.state.restaurantTier}: ${renovation.name}.`;
        this.celebrate(this.announcement);
        await this.showPurchasedRoom();
      } else {
        this.buyError = result.message;
        this.announcement = result.message;
      }
    } catch {
      if (this.uid !== uid || this.generation !== generation) return;
      this.buyError = 'Kunde inte bekräfta renoveringen. Försök igen; du debiteras bara en gång.';
    } finally {
      if (this.uid === uid && this.generation === generation) {
        this.isBuying = null;
        this.host?.render();
      }
    }
  }
  private tickerId: ReturnType<typeof setInterval> | number | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private idempotencyKey: string | null = null;
  private host: CourseHostContext | null = null;
  private generation = 0;
  private syncing = false;
  private progressSnapshot: CourseProgressData | null = null;
  private purchaseKeys = new Map<string, string>();
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public toggleOverlay(overlay: 'shop' | 'menu'): void {
    this.previewDecorationId = null;
    this.showingPurchase = false;
    this.activeOverlay = this.activeOverlay === overlay ? null : overlay;
    if (this.activeOverlay === 'menu') this.setMenuSection(this.menuSection, true);
    else this.host?.render();
  }

  public closeOverlay(): void {
    if (this.activeOverlay !== null) {
      const trigger = this.activeOverlay === 'shop' ? 'sushi-toggle-shop' : 'sushi-toggle-menu';
      this.activeOverlay = null;
      this.host?.render();
      if (typeof document !== 'undefined')
        document.querySelector<HTMLElement>(`[data-testid="${trigger}"]`)?.focus();
    }
  }

  public setShopFilter(category: string): void {
    this.shopCategoryFilter = category;
    this.host?.render();
  }

  public openDecorationShop(): void {
    this.previewDecorationId = null;
    this.shopCategoryFilter = 'decoration';
    this.activeOverlay = 'shop';
    this.host?.render();
  }

  public openGoalShop(itemId?: string): void {
    this.previewDecorationId = null;
    this.shopCategoryFilter = 'all';
    this.activeOverlay = 'shop';
    this.host?.render();
    if (itemId && typeof document !== 'undefined')
      queueMicrotask(() =>
        document
          .querySelector<HTMLElement>(
            itemId === 'renovation'
              ? '[data-testid="sushi-renovation-card"]'
              : `[data-testid="unlock-card-${itemId}"]`,
          )
          ?.scrollIntoView({ block: 'nearest' }),
      );
  }

  public previewDecoration(itemId: string): void {
    const item = getCatalogItem(itemId);
    if (
      !this.state ||
      item?.category !== 'decoration' ||
      this.isEquipping ||
      this.isBuying ||
      this.isCollecting
    )
      return;
    this.previewDecorationId = item.id;
    this.sceneArrival = null;
    this.greetingIndex = -1;
    this.activeOverlay = null;
    this.equipError = null;
    this.announcement = `Förhandsvisning: ${item.name}. Prova utan att ändra inredningen.`;
    this.host?.render();
    if (typeof document !== 'undefined')
      document.querySelector<HTMLElement>('[data-testid="sushi-decoration-preview"]')?.focus();
  }

  public cycleDecorationPreview(direction: -1 | 1): void {
    if (!this.previewDecorationId || this.isEquipping) return;
    const decorations = SUSHI_CATALOG.filter((item) => item.category === 'decoration');
    const index = decorations.findIndex((item) => item.id === this.previewDecorationId);
    this.previewDecorationId =
      decorations[(index + direction + decorations.length) % decorations.length].id;
    this.equipError = null;
    this.host?.render();
  }

  public closeDecorationPreview(returnToShop = false): void {
    const itemId = this.previewDecorationId;
    this.previewDecorationId = null;
    this.activeOverlay = returnToShop ? 'shop' : null;
    this.host?.render();
    if (typeof document !== 'undefined') {
      const target = returnToShop ? `preview-decoration-${itemId}` : 'sushi-toggle-shop';
      document.querySelector<HTMLElement>(`[data-testid="${target}"]`)?.focus();
    }
  }

  public async placePreviewDecoration(): Promise<void> {
    const item = getCatalogItem(this.previewDecorationId ?? '');
    if (!item?.slotType || !this.state?.inventory.includes(item.id)) return;
    const uid = this.uid;
    const generation = this.generation;
    await this.equip(item.slotType, item.id);
    if (
      this.uid === uid &&
      this.generation === generation &&
      this.previewDecorationId === item.id &&
      this.state?.equipped[item.slotType] === item.id &&
      !this.equipError
    ) {
      this.closeDecorationPreview();
    }
  }

  public init(
    uid: string,
    host: CourseHostContext,
    courseProgressSnapshot?: CourseProgressData | null,
  ): void {
    const earnedGrants = courseProgressSnapshot
      ? evaluateMedalGrants(courseProgressSnapshot, courseWeeks)
      : [];

    if (this.uid === uid && (this.state !== null || this.loading || this.error)) {
      this.host = host;
      if (earnedGrants.length > 0) {
        void this.syncGrantsIfChanged(earnedGrants);
      }
      return;
    }

    this.reset();
    this.uid = uid;
    this.host = host;
    this.clientReceivedAtMs = Date.now();

    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function' &&
      !this.keyHandler
    ) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (this.showFinale) {
          if (e.key === 'Escape') this.dismissFinale();
          if (e.key === 'Tab' && typeof document !== 'undefined') {
            const panel = document.querySelector<HTMLElement>('[data-testid="sushi-finale"]');
            const buttons = panel?.querySelectorAll<HTMLButtonElement>('button');
            const first = buttons?.[0],
              last = buttons?.[buttons.length - 1];
            if (
              first &&
              last &&
              (e.shiftKey
                ? document.activeElement === first || document.activeElement === panel
                : document.activeElement === last || document.activeElement === panel)
            ) {
              e.preventDefault();
              (e.shiftKey ? last : first).focus();
            }
          }
          return;
        }
        if (e.key === 'Escape') {
          if (this.activeOverlay !== null) this.closeOverlay();
          else if (this.showingPurchase) this.closePurchase();
          else if (this.previewTier !== null) this.closeRenovationPreview();
          else if (this.previewDecorationId !== null) this.closeDecorationPreview();
          else if (this.greetingIndex >= 0) this.dismissGreeting();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    this.progressSnapshot = courseProgressSnapshot ?? null;
    this.guestLessonNumber =
      courseWeeks.find((week) => week.id === courseProgressSnapshot?.activeWeekId)?.lessonNumber ??
      6;
    const generation = this.generation;
    this.loading = true;

    // Fetch authoritative state from backend with retroactive grants
    void (async () => {
      await waitForStudySync(host, uid);
      if (this.generation !== generation) throw new Error('Account changed');
      return getOrInitRestaurant(uid, Date.now(), earnedGrants);
    })()
      .then((authoritative) => {
        if (this.uid !== uid || this.generation !== generation) return; // Account switched while in flight
        const prevGrants = new Set(this.state?.permanentGrants || []);
        const newGrants = authoritative.permanentGrants.filter(
          (g) => !prevGrants.has(g) && !authoritative.inventory.includes(g),
        );

        this.state = authoritative;
        this.clientReceivedAtMs = Date.now();
        this.loading = false;

        if (newGrants.length > 0) {
          this.recentlyUnlocked = Array.from(new Set([...this.recentlyUnlocked, ...newGrants]));
          this.announcement = this.formatAnnouncement(newGrants);
        } else {
          this.announcement = `Välkommen till din sushirestaurang! Intäktstakten är ${
            calculateProductionRate(
              authoritative.kitchenCapacity,
              authoritative.serviceCapacity,
              authoritative.averageRevenuePerOrder,
            ).yenPerMinute
          } yen per minut.`;
        }
        this.checkCompletion();
        this.host?.render();
      })
      .catch((err: unknown) => {
        if (this.uid !== uid || this.generation !== generation) return;
        this.loading = false;
        const code = (err as { code?: string })?.code;
        this.error =
          code === 'functions/unauthenticated' || code === 'functions/permission-denied'
            ? 'Åtkomst nekad. Logga in med ditt Google-konto och försök igen.'
            : 'Kunde inte ansluta till restaurangen. Kontrollera anslutningen och försök igen.';
        this.host?.render();
      });

    // Start 1 Hz local ticker
    if (typeof window !== 'undefined') {
      this.tickerId = window.setInterval(() => {
        // Suppress DOM re-renders in background tabs to conserve CPU and battery
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        if (this.host && !this.loading) {
          this.host.render();
        }
      }, 1000);

      // Throttling via Page Visibility API
      if (typeof document !== 'undefined') {
        const onVisibility = () => {
          // Update the scene's paused state on both hide and show.
          this.host?.render();
        };
        document.addEventListener('visibilitychange', onVisibility);
        this.visibilityCleanup = () => {
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }
    }
  }

  public reset(): void {
    this.sceneTier = null;
    this.sceneAssetError = '';
    this.sceneTransition = 0;
    this.roomLoads.clear();
    this.renovationKeys.clear();
    if (this.rewardTimer) clearTimeout(this.rewardTimer);
    this.rewardTimer = null;
    this.rewardMessage = '';
    this.sceneArrival = null;
    this.purchasedItemId = null;
    this.showingPurchase = false;
    this.menuSection = 'decoration';
    this.greetingIndex = -1;
    this.guestMode = 'welcome';
    this.guestLessonNumber = 6;
    this.guestAnswerRevealed = false;
    this.goalMode = 'grow';
    this.showFinale = false;
    this.buildingProjectId = null;
    this.projectError = null;
    this.projectKeys.clear();
    this.speechError = '';
    this.isEquipping = false;
    this.equipError = null;
    this.equipRequest = null;
    this.generation++;
    this.syncing = false;
    this.progressSnapshot = null;
    this.purchaseKeys.clear();
    if (this.tickerId !== null) {
      if (typeof window !== 'undefined' && window.clearInterval) {
        window.clearInterval(this.tickerId as number);
      } else {
        clearInterval(this.tickerId as ReturnType<typeof setInterval>);
      }
      this.tickerId = null;
    }
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }
    this.uid = null;
    this.state = null;
    this.loading = false;
    this.error = null;
    this.isCollecting = false;
    this.isBuying = null;
    this.buyError = null;
    this.announcement = '';
    this.recentlyUnlocked = [];
    this.idempotencyKey = null;
    this.host = null;
    if (
      this.keyHandler &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.activeOverlay = null;
    this.shopCategoryFilter = 'all';
    this.previewDecorationId = null;
  }

  private async syncGrantsIfChanged(earnedGrants: string[]): Promise<void> {
    if (
      !this.state ||
      !this.uid ||
      this.syncing ||
      this.isCollecting ||
      this.isBuying ||
      this.isEquipping ||
      earnedGrants.length === 0
    )
      return;

    const currentGrants = new Set(this.state.permanentGrants || []);
    const newlyEarned = earnedGrants.filter((g) => !currentGrants.has(g));

    if (newlyEarned.length === 0) return;

    this.syncing = true;
    const generation = this.generation;
    try {
      const activeUid = this.uid;
      await waitForStudySync(this.host, activeUid);
      if (this.generation !== generation) return;
      const updatedState = await syncMedalGrants(activeUid, earnedGrants, Date.now());
      if (this.uid !== activeUid || this.generation !== generation) return;

      this.state = updatedState;
      this.clientReceivedAtMs = Date.now();
      const confirmedGrants = updatedState.permanentGrants.filter(
        (grant) => !currentGrants.has(grant),
      );
      this.recentlyUnlocked = Array.from(new Set([...this.recentlyUnlocked, ...confirmedGrants]));
      this.announcement = this.formatAnnouncement(confirmedGrants);
      this.host?.render();
    } catch (_err) {
      // Ticket 05 requirement: Temporary synchronization error is not proof of missing progress.
      // Preserve existing grants without rollback or error banner blocking restaurant usage.
    } finally {
      if (this.generation === generation) this.syncing = false;
    }
  }

  public dismissRecentlyUnlocked(): void {
    this.recentlyUnlocked = [];
    this.host?.render();
  }

  public getRecentlyUnlockedNames(): string[] {
    return this.recentlyUnlocked.map((id) => {
      const item = SUSHI_UNLOCK_CATALOG.find((cat) => cat.id === id);
      return item ? item.name : id;
    });
  }

  public formatAnnouncement(newGrants: string[]): string {
    if (newGrants.length === 1) {
      const item = SUSHI_UNLOCK_CATALOG.find((i) => i.id === newGrants[0]);
      const name = item ? item.name : newGrants[0];
      const lesson = item
        ? `Kapitel ${item.requiredLesson} ${item.requiredTierLabel}medalj`
        : 'kursmedalj';
      return `Grattis! Ny kursbelöning upplåst: ${name} från ${lesson}. Föremålet är nu tillgängligt att köpa i butiken.`;
    }
    if (newGrants.length > 1) {
      const names = newGrants
        .map((id) => SUSHI_UNLOCK_CATALOG.find((i) => i.id === id)?.name || id)
        .join(', ');
      return `Grattis! ${newGrants.length} nya kursbelöningar upplåsta från dina kursmedaljer: ${names}. Föremålen är nu tillgängliga att köpa i butiken.`;
    }
    return '';
  }

  /**
   * Recalculates estimated uncollected revenue based on elapsed wall-clock time
   * clamped to the restaurant's current storage cap.
   */
  public recalculate(): {
    displayedUncollectedYen: number;
    currentUncollectedUnits: number;
    currentUsedProductionMs: number;
    isCapped: boolean;
    progressPercent: number;
    rate: ProductionRate;
  } {
    if (!this.state) {
      const defaultRate = calculateProductionRate(1, 2, 10);
      return {
        displayedUncollectedYen: 0,
        currentUncollectedUnits: 0,
        currentUsedProductionMs: 0,
        isCapped: false,
        progressPercent: 0,
        rate: defaultRate,
      };
    }

    const rate = calculateProductionRate(
      this.state.kitchenCapacity,
      this.state.serviceCapacity,
      this.state.averageRevenuePerOrder,
    );

    const nowMs = Date.now();
    const elapsedMs = Math.max(0, nowMs - this.clientReceivedAtMs);
    const remainingCapMs = Math.max(0, this.state.capMs - this.state.usedProductionMs);
    const producedMs = Math.min(elapsedMs, remainingCapMs);
    const additionalUnits = rate.yenPerMinute * producedMs;

    const currentUncollectedUnits = this.state.uncollectedUnits + additionalUnits;
    const currentUsedProductionMs = this.state.usedProductionMs + producedMs;
    const isCapped = currentUsedProductionMs >= this.state.capMs;
    const displayedUncollectedYen = Math.floor(currentUncollectedUnits / 60_000);
    const progressPercent = Math.min(
      100,
      Math.floor((currentUsedProductionMs / this.state.capMs) * 100),
    );

    return {
      displayedUncollectedYen,
      currentUncollectedUnits,
      currentUsedProductionMs,
      isCapped,
      progressPercent,
      rate,
    };
  }

  /**
   * Executes manual collection ("Hämta intäkter") with optimistic UI update,
   * idempotency key preservation, and rollback on failure.
   */
  public async collect(): Promise<void> {
    if (this.isEquipping) return;
    if (this.isCollecting || this.isBuying || this.syncing || !this.state || !this.uid) return;

    const calc = this.recalculate();
    if (calc.displayedUncollectedYen <= 0) return;

    if (!this.idempotencyKey) {
      this.idempotencyKey = `collect_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    const key = this.idempotencyKey;
    const activeUid = this.uid;

    const generation = this.generation;
    this.isCollecting = true;
    this.error = null;
    this.announcement = 'Hämtar intäkter…';
    this.host?.render();

    // 2. Authoritative backend call
    try {
      const res = await collectRevenue(activeUid, key, Date.now());
      if (this.uid === activeUid && this.generation === generation) {
        this.state = res.state;
        this.clientReceivedAtMs = Date.now();
        this.celebrate(`+ ¥ ${res.collectedYen}`);
        this.idempotencyKey = null; // Key succeeded; reset for next collection
        this.isCollecting = false;
        this.announcement = `Hämtade ${res.collectedYen} yen. Nytt saldo: ${unitsToWholeYen(
          this.state.balanceUnits,
        )} yen.`;
        this.host?.render();
      }
    } catch (err: unknown) {
      if (this.uid === activeUid && this.generation === generation) {
        this.isCollecting = false;
        this.error = 'Kunde inte hämta intäkterna på grund av nätverksfel. Försök igen.';
        this.announcement =
          'Fel vid hämtning. Dina intäkter är inte förlorade. Klicka på Försök igen.';
        this.host?.render();
      }
    }
  }

  public retry(): void {
    if (!this.uid || !this.host) return;
    if (this.state) {
      void this.collect();
      return;
    }
    const uid = this.uid;
    const host = this.host;
    const progress = this.progressSnapshot;
    this.reset();
    this.init(uid, host, progress);
    host.render();
  }

  /**
   * Purchases an upgrade item from the catalog.
   */
  public async buy(itemId: string): Promise<void> {
    if (this.isEquipping) return;
    if (this.isBuying || this.isCollecting || this.syncing || !this.state || !this.uid) return;
    const item = getCatalogItem(itemId);
    if (!item) return;
    const purchasePreview = previewCatalogPurchase(this.state, itemId);

    this.isBuying = itemId;
    this.buyError = null;
    const activeUid = this.uid;
    const generation = this.generation;
    const key =
      this.purchaseKeys.get(itemId) ??
      'buy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    this.purchaseKeys.set(itemId, key);
    this.host?.render();

    try {
      const res = await purchaseCatalogItem(activeUid, itemId, key, Date.now());
      if (this.uid === activeUid && this.generation === generation) {
        this.purchaseKeys.delete(itemId);
        if (res.state) {
          this.state = res.state;
          this.clientReceivedAtMs = Date.now();
        }
        if (res.success) {
          this.state = res.state;
          this.clientReceivedAtMs = Date.now();
          this.markSceneArrival(item.id);
          this.purchasedItemId = item.id;
          this.celebrate(`Nyhet! ${item.name}`);
          const feedback = purchasePreview?.educationalExplanation || item.effectDescription;
          this.announcement = `Köp genomfört: ${item.name} för ¥ ${item.priceYen}! ${feedback}`;
          this.checkCompletion();
        } else {
          this.buyError = res.message;
          this.announcement = `Kunde inte köpa ${item.name}: ${res.message}`;
        }
        this.isBuying = null;
        this.host?.render();
        if (res.success && this.activeOverlay === 'shop' && typeof document !== 'undefined') {
          document.querySelector<HTMLElement>('[data-testid="sushi-see-purchase"]')?.focus();
        }
      }
    } catch (_err) {
      if (this.uid === activeUid && this.generation === generation) {
        this.isBuying = null;
        this.buyError = 'Ett nätverksfel uppstod vid köpet. Försök igen.';
        this.announcement = 'Kunde inte slutföra köpet på grund av anslutningsfel.';
        this.host?.render();
      }
    }
  }

  public async buyProject(projectId: string): Promise<void> {
    if (
      !this.uid ||
      !this.state ||
      this.isBuying ||
      this.isCollecting ||
      this.isEquipping ||
      this.syncing
    )
      return;
    const project = getRestaurantProject(projectId);
    if (!project) return;
    const uid = this.uid,
      generation = this.generation;
    const key =
      this.projectKeys.get(projectId) ??
      `project_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.projectKeys.set(projectId, key);
    this.isBuying = `project:${projectId}`;
    this.buildingProjectId = projectId;
    this.projectError = null;
    this.host?.render();
    try {
      const result = await purchaseRestaurantProject(uid, projectId, key, Date.now());
      if (this.uid !== uid || this.generation !== generation) return;
      this.projectKeys.delete(projectId);
      if (result.state) {
        this.state = result.state;
        this.clientReceivedAtMs = Date.now();
      }
      if (result.success) {
        this.celebrate(`${project.icon} ${project.name} är på plats!`);
        this.announcement = `${project.name} är byggt och syns nu i restaurangen. Intäktstakten är oförändrad.`;
      } else this.projectError = result.message;
    } catch {
      if (this.uid !== uid || this.generation !== generation) return;
      this.projectError =
        'Projektet kunde inte sparas. Försök igen; samma köp debiteras bara en gång.';
    } finally {
      if (this.uid === uid && this.generation === generation) {
        this.isBuying = null;
        this.buildingProjectId = null;
        this.host?.render();
      }
    }
  }

  public async equip(slot: DecorationSlot, itemId: string | null): Promise<void> {
    if (
      !this.uid ||
      !this.state ||
      this.isEquipping ||
      this.isBuying ||
      this.isCollecting ||
      this.syncing
    )
      return;
    const uid = this.uid;
    const generation = this.generation;
    const previouslyEquipped = this.state.equipped[slot];
    if (this.equipRequest?.slot !== slot || this.equipRequest.itemId !== itemId) {
      this.equipRequest = {
        slot,
        itemId,
        key: `decor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      };
    }
    this.isEquipping = true;
    this.equipError = null;
    this.host?.render();
    try {
      const result = await equipDecoration(uid, slot, itemId, this.equipRequest.key);
      if (this.uid !== uid || this.generation !== generation) return;
      this.equipRequest = null;
      if (result.success) {
        this.state = result.state;
        this.clientReceivedAtMs = Date.now();
        const savedItem = result.state.equipped[slot];
        if (savedItem && savedItem !== previouslyEquipped) this.markSceneArrival(savedItem);
        this.announcement = savedItem
          ? `${getCatalogItem(savedItem)?.name} visas på platsen.`
          : 'Dekorationsplatsen är tom.';
      } else {
        this.equipError = result.message;
      }
    } catch {
      if (this.uid !== uid || this.generation !== generation) return;
      this.equipError =
        'Kunde inte spara dekorationsvalet. Försök igen genom att välja dekorationen på nytt.';
    } finally {
      if (this.uid === uid && this.generation === generation) {
        this.isEquipping = false;
        this.host?.render();
      }
    }
  }
}

// Module-level controller singleton
const activeController = new SushiClientController();

export function leaveSushiView(): void {
  activeController.reset();
}

/**
 * Renderar spärrsidan (Auth Gate) för oinloggade besökare eller anonyma sessioner.
 * Gäståtkomst eller gästdemo tillåts inte enligt Ticket 02.
 */
function renderSushiAuthGate(host: CourseHostContext, onBackToStudies: () => void): TemplateResult {
  const handleLogin = () => {
    if (host.onLogin) {
      host.onLogin();
    } else {
      host.account();
    }
  };

  const handleLocalLogin = () => {
    const localUser = {
      uid: 'local-dev-user',
      displayName: 'Lokal student',
      email: 'student@localhost',
    };
    try {
      sessionStorage.setItem('japc11-mock-user', JSON.stringify(localUser));
    } catch {}
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __setMockUser?: (u: unknown) => void }).__setMockUser
    ) {
      (window as unknown as { __setMockUser: (u: unknown) => void }).__setMockUser(localUser);
    }
  };

  return html`
    <div
      class="sushi-auth-gate"
      data-testid="sushi-auth-gate"
      role="region"
      aria-label="Inloggningskrav"
    >
      <div class="sushi-auth-card">
        <div class="sushi-auth-icon" aria-hidden="true">🍣🔒</div>
        <h2>Logga in för att öppna restaurangen</h2>
        <p>
          Din sushirestaurang är personlig och kopplas till dina studieresultat i Genki I. Logga in
          med ditt Google-konto för att starta restaurangen och tjäna yen.
        </p>
        <p class="sushi-auth-note">
          Gäståtkomst eller demo stöds inte. Restaurangen kräver ett inloggat Google-konto.
        </p>

        <div class="sushi-auth-actions">
          <button
            type="button"
            class="sushi-btn-primary"
            data-testid="sushi-login-btn"
            ?disabled=${host.authBusy}
            @click=${handleLogin}
          >
            ${host.authBusy ? 'Loggar in...' : 'Logga in med Google'}
          </button>

          ${
            isLocalhost()
              ? html`
                  <button
                    type="button"
                    class="sushi-btn-secondary sushi-local-login-btn"
                    data-testid="sushi-local-login-btn"
                    @click=${handleLocalLogin}
                    title="Öppna restaurangen direkt med ett lokalt testkonto på localhost"
                  >
                    🍣 Öppna lokalt (testkonto)
                  </button>
                `
              : ''
          }

          <button
            type="button"
            class="sushi-btn-secondary"
            data-testid="sushi-back-btn"
            @click=${onBackToStudies}
          >
            ← Tillbaka till studierna
          </button>
        </div>

        ${
          host.authError
            ? html`
                <div class="sushi-auth-error" role="alert" data-testid="sushi-auth-error">
                  <span>⚠️ ${host.authError}</span>
                  <button type="button" class="sushi-retry-btn" @click=${handleLogin}>
                    Försök igen
                  </button>
                </div>
              `
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * Renderar restaurangens aktiva vy för en inloggad student.
 * Inkluderar disponibelt saldo, kassaregister med ohämtade intäkter,
 * produktionstakt och flaskhals, åttatimmarstak, hämtningsknapp,
 * permanenta upplåsningar från kursmedaljer, och ARIA live region.
 */
function renderSushiAuthenticatedStage(
  host: CourseHostContext,
  user: NonNullable<CourseHostContext['user']>,
  onBackToStudies: () => void,
  courseProgressSnapshot?: CourseProgressData | null,
  onNavigateToChapter?: (lessonNumber: number, weekId: string) => void,
): TemplateResult {
  activeController.init(user.uid, host, courseProgressSnapshot);

  const displayName = user.displayName || user.email || 'student';
  const state = activeController.state;
  if (!state) {
    return html`<section
      class="sushi-stage"
      data-testid="sushi-stage"
      aria-busy=${activeController.loading}
    >
      <h2>Välkommen, ${displayName}!</h2>
      ${
        activeController.error
          ? html`<div role="alert" data-testid="sushi-load-error">
              ${activeController.error}
              <button type="button" @click=${() => activeController.retry()}>Försök igen</button>
            </div>`
          : html`<p role="status" data-testid="sushi-loading">Laddar din restaurang…</p>`
      }
      <button type="button" @click=${onBackToStudies}>← Tillbaka till studierna</button>
    </section>`;
  }
  const spendableYen = unitsToWholeYen(state.balanceUnits);
  const calc = activeController.recalculate();
  const { displayedUncollectedYen, currentUsedProductionMs, isCapped, progressPercent, rate } =
    calc;

  const usedHoursStr = (currentUsedProductionMs / 3_600_000).toFixed(1);
  const capHoursStr = (state.capMs / 3_600_000).toFixed(0);
  const extendedCap = state.capMs >= EXTENDED_CAP_MS;
  const ordersPerMinute = (count: number) => `${count} ${count === 1 ? 'order' : 'ordrar'}/min`;

  const bottleneckText =
    rate.bottleneck === 'kitchen'
      ? 'Kök (Flaskhals)'
      : rate.bottleneck === 'service'
        ? 'Service (Flaskhals)'
        : 'Balanserad produktion';

  const handleNavigateToChapter = (lessonNumber: number, weekId: string) => {
    if (onNavigateToChapter) {
      onNavigateToChapter(lessonNumber, weekId);
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.hash = `#/vecka/${weekId}`;
    }
  };

  const unlockedCount =
    state && Array.isArray(state.permanentGrants)
      ? state.permanentGrants.filter((g) => SUSHI_UNLOCK_CATALOG.some((c) => c.id === g)).length
      : 0;

  const phrases = [
    { ja: 'いらっしゃいませ！', reading: 'Irasshaimase!', sv: 'Välkommen in!' },
    { ja: 'いただきます！', reading: 'Itadakimasu!', sv: 'Tack för maten — innan vi äter.' },
    { ja: 'おいしいです！', reading: 'Oishii desu!', sv: 'Det är gott!' },
  ];
  const phrase =
    activeController.guestMode === 'welcome' ? phrases[activeController.greetingIndex] : undefined;
  const guestDeck = getGuestStudyDeck(activeController.guestLessonNumber);
  const guestCard =
    activeController.guestMode === 'study' && activeController.greetingIndex >= 0
      ? guestDeck[activeController.greetingIndex % guestDeck.length]
      : undefined;
  activeController.preloadRenovation();
  const tier = currentRestaurantTier(state);
  const previewRenovation = activeController.previewTier !== null;
  const previewDecoration = getCatalogItem(activeController.previewDecorationId ?? '');
  const previewOwned = previewDecoration ? state.inventory.includes(previewDecoration.id) : false;
  const previewEquipped = previewDecoration?.slotType
    ? state.equipped[previewDecoration.slotType] === previewDecoration.id
    : false;
  const purchasedItem = getCatalogItem(activeController.purchasedItemId ?? '');
  const showingPurchase = Boolean(activeController.showingPurchase && purchasedItem);
  const formatTightComma = (n: number) => {
    const parts = n.toLocaleString('en-US').split(',');
    return parts.map((p, idx) =>
      idx < parts.length - 1 ? html`${p}<span class="sushi-comma">,</span>` : p,
    );
  };

  return html`
    <div class="sushi-container" data-testid="sushi-container">
      <section
        class="sushi-stage ${previewDecoration || previewRenovation || showingPurchase ? 'is-previewing' : ''} ${previewRenovation ? 'is-previewing-renovation' : ''} ${showingPurchase ? 'is-showing-purchase' : ''}"
        data-testid="sushi-stage"
        aria-label="Personlig sushirestaurang"
      >
        <!-- Saldo och aktuell produktion -->
        <div class="sushi-hud-floating-layer">
          <div class="sushi-stage-header" data-testid="sushi-stage-header">
            <h2 class="sr-only">Välkommen, ${displayName}!</h2>
            <p class="sushi-tier-badge" data-testid="sushi-current-tier">
              Restaurangnivå ${tier}/3 · ${RESTAURANT_TIER_NAMES[tier]}
            </p>
            <div class="sushi-balance-badge pixel-panel" data-testid="sushi-spendable-balance">
              <span class="sr-only sushi-plaque-icon"
                >${renderPixelIcon('coins')} Disponibelt saldo: ¥ ${spendableYen}</span
              >
              <span class="sushi-funds-label" aria-hidden="true">Saldo</span>
              <strong class="sushi-balance-amount" aria-hidden="true"
                >¥ ${formatTightComma(spendableYen)}</strong
              >
            </div>
            <p class="sushi-stage-intro sr-only">
              Din restaurang producerar och tjänar yen i realtid. Hämta intäkterna till ditt
              disponibla saldo.
            </p>
          </div>

          <!-- Aktuell produktion och flaskhals -->
          <div class="sushi-rate-bar" data-testid="sushi-rate-info">
            <span aria-hidden="true">${renderPixelIcon('coins')}</span>
            <strong>${rate.yenPerMinute} ¥/min</strong>
            <span class="sr-only"
              >Intäktstakt: Kök: ${ordersPerMinute(state.kitchenCapacity)} · Service:
              ${ordersPerMinute(state.serviceCapacity)} · ${bottleneckText}</span
            >
          </div>
          <!-- Festlig upplåsningsnotis (Ticket 05) -->
          ${
            activeController.recentlyUnlocked.length > 0
              ? html`
                  <aside
                    class="sushi-unlock-banner pixel-panel"
                    data-testid="sushi-unlock-banner"
                    role="status"
                    aria-live="polite"
                  >
                    <div class="sushi-unlock-banner-content">
                      <span class="sushi-unlock-banner-icon" aria-hidden="true">🎉🔓</span>
                      <div class="sushi-unlock-banner-text">
                        <strong>Ny kursbelöning upplåst!</strong>
                        <p>
                          <strong>${activeController.getRecentlyUnlockedNames().join(', ')}</strong>
                          · Finns nu i butiken.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="sushi-banner-dismiss-btn pixel-btn"
                      data-testid="sushi-banner-dismiss-btn"
                      @click=${() => activeController.dismissRecentlyUnlocked()}
                      aria-label="Stäng notis om ny upplåsning"
                    >
                      ×
                    </button>
                  </aside>
                `
              : ''
          }
        </div>

        <!-- Restaurangens köpta utrustning och placerade dekorationer -->
        <div class="sushi-stage-scene-wrap">
          ${renderRestaurantScene(state, {
            onGreet: () => activeController.greet(),
            tier: activeController.previewTier ?? activeController.sceneTier ?? tier,
            previewing: previewRenovation,
            transition: activeController.sceneTransition,
            productionStopped: isCapped,
            paused: activeController.activeOverlay !== null || activeController.showFinale,
            previewDecorationId: previewDecoration?.id,
            arrival: previewDecoration ? null : activeController.sceneArrival,
            spotlightItemId: showingPurchase ? purchasedItem?.id : undefined,
          })}
        </div>
        ${
          showingPurchase && purchasedItem
            ? html`<section
                class="sushi-purchase-view pixel-panel"
                data-testid="sushi-purchase-view"
                tabindex="-1"
                aria-label="Ditt nya köp i restaurangen"
              >
                <span
                  class="sushi-atlas-sprite sushi-purchase-sprite"
                  aria-hidden="true"
                  style=${spriteStyle(SUSHI_SPRITES[purchasedItem.id])}
                ></span>
                <div>
                  <span class="sushi-preview-label">✓ Köpt och på plats</span>
                  <h3>${purchasedItem.name}</h3>
                  <p>${purchasedItem.effectDescription}</p>
                  <p class="sushi-purchase-location">
                    Den gyllene markeringen visar ditt nya föremål.
                  </p>
                </div>
                <div class="sushi-purchase-actions">
                  <button
                    type="button"
                    class="pixel-btn sushi-btn-secondary"
                    @click=${() => activeController.closePurchase(true)}
                  >
                    Tillbaka till butik
                  </button>
                  <button
                    type="button"
                    class="pixel-btn sushi-btn-primary"
                    @click=${() => activeController.closePurchase()}
                  >
                    Klart
                  </button>
                </div>
              </section>`
            : ''
        }
        ${
          previewDecoration
            ? html`
                <section
                  class="sushi-decoration-preview pixel-panel"
                  role="region"
                  aria-label="Förhandsvisa dekoration"
                  tabindex="-1"
                  data-testid="sushi-decoration-preview"
                  aria-busy=${activeController.isEquipping}
                >
                  <button
                    type="button"
                    class="sushi-preview-close pixel-btn"
                    aria-label="Avsluta förhandsvisning"
                    data-testid="sushi-preview-close"
                    @click=${() => activeController.closeDecorationPreview()}
                  >
                    ${renderPixelIcon('close')}
                  </button>
                  <div class="sushi-preview-info">
                    <span class="sushi-preview-label">Förhandsvisning</span>
                    <h3 aria-live="polite" data-testid="sushi-preview-name">
                      ${previewDecoration.name}
                    </h3>
                    <p>
                      ${previewDecoration.slotType === 'wallSlot' ? 'Väggplats' : 'Golvplats'} ·
                      ${previewOwned ? (previewEquipped ? 'Redan placerad' : 'Ägd · Inte placerad') : `¥ ${previewDecoration.priceYen} · ${state.permanentGrants.includes(previewDecoration.id) ? 'Finns att köpa i butiken' : `Låst: Kapitel ${previewDecoration.requiredLesson} ${previewDecoration.requiredTierLabel} (${previewDecoration.requiredPercent} %)`}`}
                    </p>
                    ${activeController.equipError ? html`<p role="alert">${activeController.equipError}</p>` : ''}
                  </div>
                  <div class="sushi-preview-actions">
                    <div class="sushi-preview-browse">
                      <button
                        type="button"
                        class="pixel-btn sushi-btn-secondary"
                        aria-label="Föregående dekoration"
                        data-testid="sushi-preview-previous"
                        ?disabled=${activeController.isEquipping}
                        @click=${() => activeController.cycleDecorationPreview(-1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        class="pixel-btn sushi-btn-secondary"
                        aria-label="Nästa dekoration"
                        data-testid="sushi-preview-next"
                        ?disabled=${activeController.isEquipping}
                        @click=${() => activeController.cycleDecorationPreview(1)}
                      >
                        →
                      </button>
                    </div>
                    <div class="sushi-preview-browse">
                      ${previewOwned ? html`<button type="button" class="pixel-btn sushi-btn-primary" data-testid="sushi-preview-place" ?disabled=${previewEquipped || activeController.isEquipping || activeController.isBuying !== null || activeController.isCollecting} @click=${() => void activeController.placePreviewDecoration()}>${activeController.isEquipping ? 'Placerar…' : previewEquipped ? 'Placerad' : 'Placera'}</button>` : ''}
                      <button
                        type="button"
                        class="pixel-btn sushi-btn-secondary"
                        data-testid="sushi-preview-shop"
                        @click=${() => activeController.closeDecorationPreview(true)}
                      >
                        Tillbaka till butik
                      </button>
                    </div>
                  </div>
                </section>
              `
            : ''
        }
        ${
          previewRenovation
            ? html`<section
                class="sushi-decoration-preview pixel-panel"
                tabindex="-1"
                aria-label="Förhandsvisa renovering"
                data-testid="sushi-renovation-preview"
              >
                <div class="sushi-renovation-preview-header">
                  <button
                    type="button"
                    class="pixel-btn"
                    @click=${() => activeController.closeRenovationPreview()}
                  >
                    ← Tillbaka till butik
                  </button>
                  <strong>Förhandsvisning · Ingen ändring före köp</strong>
                </div>
                ${renderRenovationCard(state, { buy: () => void activeController.renovate(), preview: () => {}, study: handleNavigateToChapter }, activeController.isBuying !== null, true)}
              </section>`
            : ''
        }
        ${activeController.sceneAssetError ? html`<p class="sushi-room-error" role="alert">${activeController.sceneAssetError}<button type="button" @click=${() => void activeController.showPurchasedRoom(true)}>Ladda bilden igen</button></p>` : ''}
        ${renderCompanionGoal(
          { ...state, uncollectedUnits: calc.currentUncollectedUnits },
          activeController.goalMode,
          courseProgressSnapshot,
          {
            chooseMode: (mode) => activeController.chooseGoal(mode),
            openShop: (id) => activeController.openGoalShop(id),
            openJournal: () => activeController.openJournal(),
            study: handleNavigateToChapter,
            replayFinale: () => activeController.openFinale(),
          },
        )}
        <button
          type="button"
          class="sushi-guest-hint"
          data-testid="sushi-guest-hint"
          @click=${() => activeController.greet()}
        >
          Öva japanska med en gäst
        </button>
        ${
          phrase
            ? html`<aside
                class="sushi-phrase-bubble"
                data-testid="sushi-phrase-bubble"
                aria-live="polite"
              >
                <button
                  type="button"
                  class="sushi-phrase-close"
                  aria-label="Stäng samtal"
                  @click=${() => activeController.dismissGreeting()}
                >
                  ×
                </button>
                <strong lang="ja">${phrase.ja}</strong><span>${phrase.reading}</span>
                <p>${phrase.sv}</p>
                <button
                  type="button"
                  class="pixel-btn"
                  data-testid="sushi-phrase-speak"
                  @click=${(event: Event) => activeController.speakPhrase(phrase.ja, event.currentTarget as HTMLElement)}
                >
                  🔊 Lyssna på uttal
                </button>
                ${activeController.speechError ? html`<p role="status" data-testid="sushi-speech-error">${activeController.speechError}</p>` : ''}
                <button type="button" class="pixel-btn" @click=${() => activeController.greet()}>
                  Nästa fras →
                </button>
                <button
                  type="button"
                  class="pixel-btn sushi-practice-start"
                  data-testid="sushi-start-guest-practice"
                  @click=${() => activeController.practiceGuestChapter()}
                >
                  Öva Kapitel ${activeController.guestLessonNumber} med gästen →
                </button>
              </aside>`
            : ''
        }
        ${
          guestCard
            ? html`<aside
                class="sushi-phrase-bubble sushi-guest-practice"
                aria-label="Frivillig gästträning"
                data-testid="sushi-guest-practice"
              >
                <button
                  type="button"
                  class="sushi-phrase-close"
                  aria-label="Stäng samtal"
                  @click=${() => activeController.dismissGreeting()}
                >
                  ×
                </button>
                <label class="sushi-practice-chapter"
                  >Öva med gästen
                  <select
                    aria-label="Kapitel för gästträning"
                    @change=${(event: Event) => activeController.practiceGuestChapter(Number((event.target as HTMLSelectElement).value))}
                  >
                    ${courseWeeks.map((week) => html`<option value=${String(week.lessonNumber)} .selected=${week.lessonNumber === activeController.guestLessonNumber}>Kapitel ${week.lessonNumber}</option>`)}
                  </select></label
                >
                <p>${guestCard.questionSv}</p>
                <strong lang="ja" data-testid="sushi-practice-prompt">${guestCard.promptJp}</strong>
                ${
                  activeController.guestAnswerRevealed
                    ? html`<div class="sushi-practice-answer" data-testid="sushi-practice-answer">
                        <span lang="ja">${guestCard.reading}</span>
                        <p>${guestCard.answerSv}</p>
                      </div>`
                    : html`<button
                        type="button"
                        class="pixel-btn"
                        data-testid="sushi-reveal-guest-answer"
                        @click=${() => activeController.revealGuestAnswer()}
                      >
                        Visa betydelse
                      </button>`
                }
                <div class="sushi-practice-actions">
                  <button
                    type="button"
                    class="pixel-btn"
                    @click=${(event: Event) => activeController.speakPhrase(guestCard.promptJp, event.currentTarget as HTMLElement)}
                  >
                    🔊 Lyssna</button
                  ><button
                    type="button"
                    class="pixel-btn"
                    data-testid="sushi-next-guest-example"
                    @click=${() => activeController.greet()}
                  >
                    Nästa exempel →
                  </button>
                </div>
                <small class="sushi-practice-source" data-testid="sushi-practice-source"
                  >Ur kursen · Kapitel ${guestCard.lessonNumber} · ${guestCard.sourceTitleSv}</small
                >
                <small>Frivillig repetition · påverkar inte kursresultat eller yen.</small>
                ${activeController.speechError ? html`<p role="status">${activeController.speechError}</p>` : ''}
              </aside>`
            : ''
        }
        ${activeController.rewardMessage ? html`<div class="sushi-reward-pop" data-testid="sushi-reward-pop" role="status">${activeController.rewardMessage}</div>` : ''}

        <!-- Botten-höger Kassaregister / Collect Income HUD (Ticket 04) -->
        <div
          class="sushi-cash-register pixel-border"
          data-testid="sushi-cash-register"
          role="region"
          aria-label="Kassa och ohämtade intäkter"
        >
          <div class="sushi-register-left">
            <span class="sushi-register-label">Ohämtade intäkter</span>
            <div class="sushi-register-amount" data-testid="sushi-uncollected-amount">
              <span class="sushi-yen-symbol" aria-hidden="true">¥</span>
              <span class="sushi-yen-number">${displayedUncollectedYen}</span>
            </div>
          </div>

          <div class="sushi-register-center">
            <!-- Takmätare och framsteg (Ticket 04 & 08) -->
            <div class="sushi-cap-tracker">
              <div class="sushi-cap-header">
                <div class="sushi-cap-title-row">
                  <span>Produktionstid i perioden</span>
                  ${
                    extendedCap
                      ? html`<span
                          class="sushi-cap-badge extended"
                          data-testid="sushi-cap-badge-extended"
                          >${capHoursStr}h kassa</span
                        >`
                      : html`<span
                          class="sushi-cap-badge standard"
                          data-testid="sushi-cap-badge-standard"
                          >${capHoursStr}h kassa</span
                        >`
                  }
                </div>
                <span>${usedHoursStr}h / ${capHoursStr}h</span>
              </div>
              <div
                class="sushi-progress-track"
                role="progressbar"
                aria-valuenow=${progressPercent}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label="Produktionstid i perioden"
              >
                <div
                  class="sushi-progress-fill ${isCapped ? 'capped' : ''}"
                  style="width: ${progressPercent}%"
                ></div>
              </div>
              ${
                extendedCap
                  ? html`<div
                      class="sushi-cap-active-indicator"
                      data-testid="sushi-cap-active-badge"
                    >
                      ✨ Rymligare kassa · ${capHoursStr} timmars intäkter mellan hämtningar
                    </div>`
                  : ''
              }
              ${
                isCapped
                  ? html`
                      <div
                        class="sushi-capped-notice"
                        role="status"
                        data-testid="sushi-capped-badge"
                      >
                        Kassan vilar efter ${capHoursStr} timmar. Dina intäkter finns kvar — hämta
                        när det passar för att starta en ny period.
                      </div>
                    `
                  : ''
              }
            </div>

            <details class="sushi-production-details">
              <summary>Produktion</summary>
              <div class="sushi-production-content">
                <p>
                  Kök: ${ordersPerMinute(state.kitchenCapacity)}
                  ${rate.bottleneck === 'kitchen' ? '(Flaskhals)' : ''} · Service:
                  ${ordersPerMinute(state.serviceCapacity)}
                  ${rate.bottleneck === 'service' ? '(Flaskhals)' : ''} · ${bottleneckText}
                </p>
                ${
                  rate.bottleneck !== 'none'
                    ? html`
                        <div
                          class="sushi-bottleneck-explainer register-banner"
                          data-testid="sushi-register-bottleneck-explainer"
                        >
                          💡 <strong>Flaskhalsguide:</strong>
                          ${
                            rate.bottleneck === 'kitchen'
                              ? `Köket begränsar intjäningen (${ordersPerMinute(state.kitchenCapacity)} mot ${ordersPerMinute(state.serviceCapacity)} service). Uppgradera kökskapaciteten för att höja takten.`
                              : `Servicen begränsar intjäningen (${ordersPerMinute(state.serviceCapacity)} mot ${ordersPerMinute(state.kitchenCapacity)} kök). Uppgradera transportband eller service för att höja takten.`
                          }
                        </div>
                      `
                    : ''
                }
              </div>
            </details>
          </div>

          <div class="sushi-register-right">
            <!-- Primär hämtningsknapp (Ticket 04) -->
            <button
              type="button"
              class="sushi-btn-primary sushi-collect-btn pixel-btn ${isCapped ? 'pulse-attention' : ''}"
              data-testid="sushi-collect-btn"
              ?disabled=${displayedUncollectedYen <= 0 || activeController.isCollecting}
              @click=${() => void activeController.collect()}
              aria-label="Hämta ${displayedUncollectedYen} intjänade yen till ditt disponibla saldo"
            >
              ${
                activeController.isCollecting
                  ? html`<span class="sushi-btn-spinner" aria-hidden="true"></span>
                      <span class="sushi-collect-title">Hämtar...</span>`
                  : html`<span class="sr-only">Hämta intäkter ¥ ${displayedUncollectedYen}</span>
                      <span class="sushi-collect-title" aria-hidden="true">Hämta intäkter</span>
                      <strong class="sushi-btn-yen-tag sushi-collect-yen" aria-hidden="true"
                        >¥ ${formatTightComma(displayedUncollectedYen)}</strong
                      >`
              }
            </button>
            <svg
              class="sushi-collect-sparkles"
              viewBox="0 0 48 48"
              width="44"
              height="44"
              aria-hidden="true"
            >
              <polygon points="10,4 38,14 34,20" fill="#fde073" stroke="#9c5a18" stroke-width="2" />
              <polygon points="6,12 36,34 29,39" fill="#f7c844" stroke="#9c5a18" stroke-width="2" />
              <polygon points="2,20 18,44 11,46" fill="#fde073" stroke="#9c5a18" stroke-width="2" />
            </svg>
          </div>

          ${
            activeController.error
              ? html`
                  <div class="sushi-auth-error" role="alert" data-testid="sushi-collect-error">
                    <span>⚠️ ${activeController.error}</span>
                    <button
                      type="button"
                      class="sushi-retry-btn pixel-btn"
                      @click=${() => void activeController.collect()}
                    >
                      Försök igen
                    </button>
                  </div>
                `
              : ''
          }
          ${
            activeController.buyError
              ? html`
                  <div class="sushi-auth-error" role="alert" data-testid="sushi-buy-error">
                    <span>⚠️ ${activeController.buyError}</span>
                  </div>
                `
              : ''
          }
        </div>

        <!-- Overlay Bakgrunds-scrim -->
        <div
          class="sushi-overlay-backdrop ${activeController.activeOverlay !== null ? 'is-active' : ''}"
          @click=${() => activeController.closeOverlay()}
          aria-hidden="true"
        ></div>

        <!-- In-Game Pop-up Overlay 1: Kursbelöningar & Upplåsningar (Butik) -->
        <section
          class="sushi-unlocks-panel sushi-overlay-window ${activeController.activeOverlay === 'shop' ? 'is-open' : 'is-closed'}"
          data-testid="sushi-unlocks-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Kursbelöningar och upplåsningar"
          ?data-open=${activeController.activeOverlay === 'shop'}
        >
          <div class="sushi-overlay-header">
            <div class="sushi-unlocks-title-group">
              <h3>Butik</h3>
              <span class="sushi-unlocks-count-badge" data-testid="sushi-unlocks-count-badge">
                ${unlockedCount} / ${SUSHI_CATALOG.length} upplåsta
              </span>
            </div>
            <button
              type="button"
              class="sushi-overlay-close pixel-btn"
              data-testid="sushi-close-shop-btn"
              @click=${() => activeController.closeOverlay()}
              aria-label="Stäng butiksfönstret"
            >
              ${renderPixelIcon('close')}
            </button>
          </div>

          <div class="sushi-overlay-subbar">
            <!-- Kategorifilter för butikskatalog -->
            <div class="sushi-shop-filters" role="tablist" aria-label="Kategorifilter">
              ${[
                { id: 'all', label: 'Alla' },
                { id: 'kitchen', label: 'Kök' },
                { id: 'service', label: 'Service' },
                { id: 'cap', label: 'Tid' },
                { id: 'recipe', label: 'Recept' },
                { id: 'decoration', label: 'Dekoration' },
              ].map(
                (filter) => html`
                  <button
                    type="button"
                    class="sushi-filter-tab pixel-btn ${activeController.shopCategoryFilter === filter.id ? 'is-active' : ''}"
                    role="tab"
                    data-testid="sushi-filter-${filter.id}"
                    aria-selected="${activeController.shopCategoryFilter === filter.id}"
                    @click=${() => activeController.setShopFilter(filter.id)}
                  >
                    ${filter.label}
                  </button>
                `,
              )}
            </div>
          </div>

          <div class="sushi-overlay-scroll-body">
            ${
              purchasedItem
                ? html`<aside class="sushi-purchase-receipt" data-testid="sushi-purchase-receipt">
                    <div>
                      <strong>✓ ${purchasedItem.name} är köpt</strong>
                      <span
                        >${purchasedItem.category === 'decoration' ? 'Välj var den ska visas.' : 'Se förändringen i din restaurang.'}</span
                      >
                    </div>
                    <button
                      type="button"
                      class="pixel-btn sushi-btn-primary"
                      data-testid="sushi-see-purchase"
                      @click=${() => activeController.showPurchase()}
                    >
                      ${purchasedItem.category === 'decoration' ? 'Placera i restaurangen' : 'Se i restaurangen'}
                    </button>
                  </aside>`
                : ''
            }
            <details class="sushi-shop-help">
              <summary>Så låser du upp belöningar</summary>
              <p>
                Studera och samla kapitelmedaljer för att låsa upp föremål. Upplåsning ger inte
                gratis föremål. Köp dem med yen från restaurangen.
              </p>
            </details>
            ${activeController.shopCategoryFilter === 'all' ? renderRenovationCard(state, { buy: () => void activeController.renovate(), preview: () => activeController.previewRenovation(), study: handleNavigateToChapter }, activeController.isBuying !== null || activeController.isCollecting || activeController.isEquipping) : ''}
            ${activeController.buyError ? html`<p role="alert">${activeController.buyError}</p>` : ''}
            <div class="sushi-unlocks-grid" data-testid="sushi-unlocks-grid">
              ${SUSHI_CATALOG.map((item) => {
                const isOwned = Boolean(state?.inventory && state.inventory.includes(item.id));
                const isUnlocked = Boolean(
                  state?.permanentGrants && state.permanentGrants.includes(item.id),
                );
                const isNew = activeController.recentlyUnlocked.includes(item.id);
                const canAffordItem = Boolean(state && state.balanceUnits >= item.priceUnits);
                const diffUnits = state
                  ? Math.max(0, item.priceUnits - state.balanceUnits)
                  : item.priceUnits;
                const diffYen = Math.ceil(diffUnits / 60_000);

                let purchaseState: 'locked' | 'unaffordable' | 'affordable' | 'owned' = 'locked';
                let cardStateClass = 'is-locked';
                if (isOwned) {
                  purchaseState = 'owned';
                  cardStateClass = 'is-owned';
                } else if (!isUnlocked || tier < item.requiredRestaurantTier) {
                  purchaseState = 'locked';
                  cardStateClass = 'is-locked';
                } else if (!canAffordItem) {
                  purchaseState = 'unaffordable';
                  cardStateClass = 'is-unlocked is-unaffordable';
                } else {
                  purchaseState = 'affordable';
                  cardStateClass = 'is-unlocked is-affordable';
                }

                // Filter check: revenue matches kitchen
                const matchesFilter =
                  activeController.shopCategoryFilter === 'all' ||
                  activeController.shopCategoryFilter === item.category ||
                  (activeController.shopCategoryFilter === 'kitchen' &&
                    item.category === 'revenue');
                const filterClass = matchesFilter ? '' : 'is-filtered-out';

                const preview =
                  !isOwned && state ? previewCatalogPurchase(state, item.id) : undefined;

                return html`
                  <div
                    class="sushi-unlock-card sushi-shop-card pixel-panel ${cardStateClass} ${filterClass}"
                    data-testid="unlock-card-${item.id}"
                    data-item-id="${item.id}"
                    data-purchase-state="${purchaseState}"
                  >
                    <div class="sushi-card-top">
                      <span
                        class="sushi-atlas-sprite sushi-shop-sprite"
                        aria-hidden="true"
                        style=${spriteStyle(SUSHI_SPRITES[item.id])}
                      ></span>
                      <div class="sushi-card-title-group">
                        <strong class="sushi-card-name">${item.name}</strong>
                        <span class="sushi-card-category">${item.categoryLabel}</span>
                      </div>
                      ${
                        isNew
                          ? html`<span
                              class="sushi-pill-new"
                              data-testid="unlock-pill-new-${item.id}"
                              >Ny!</span
                            >`
                          : ''
                      }
                    </div>

                    <p class="sushi-card-desc">${item.effectDescription}</p>
                    ${
                      !isOwned && tier < item.requiredRestaurantTier
                        ? html`<p data-testid=${`tier-requirement-${item.id}`}>
                              Kräver restaurangnivå ${item.requiredRestaurantTier} · Pris ¥
                              ${item.priceYen}
                            </p>
                            <button
                              type="button"
                              class="pixel-btn"
                              @click=${() => {
                                activeController.setShopFilter('all');
                                document
                                  .querySelector('[data-testid="sushi-renovation-card"]')
                                  ?.scrollIntoView({ block: 'nearest' });
                              }}
                            >
                              Se nästa renovering ↑
                            </button>`
                        : ''
                    }
                    ${
                      preview && item.kitchenCapacityDelta
                        ? html`<p class="sushi-card-desc" data-testid="capacity-preview-${item.id}">
                            Kök: ${state.kitchenCapacity} → ${preview.newKitchenCapacity} ordrar/min
                          </p>`
                        : preview && item.serviceCapacityDelta
                          ? html`<p
                              class="sushi-card-desc"
                              data-testid="capacity-preview-${item.id}"
                            >
                              Service: ${state.serviceCapacity} → ${preview.newServiceCapacity}
                              ordrar/min
                            </p>`
                          : ''
                    }
                    ${
                      preview &&
                      (preview.ordersDelta !== 0 ||
                        preview.yenDelta !== 0 ||
                        item.kitchenCapacityDelta ||
                        item.serviceCapacityDelta ||
                        preview.hasImmediateEffect)
                        ? html`
                            <div
                              class="sushi-upgrade-preview"
                              data-testid="upgrade-preview-${item.id}"
                            >
                              Takt efter köp:
                              <strong>${preview.prospectiveRate.yenPerMinute} ¥/min</strong>
                              (${preview.yenDelta >= 0 ? '+' : ''}${preview.yenDelta} ¥/min)
                            </div>
                          `
                        : ''
                    }
                    ${
                      preview?.isBottleneckLimiting
                        ? html`
                            <div
                              class="sushi-bottleneck-explainer"
                              data-testid="bottleneck-explainer-${item.id}"
                            >
                              💡 ${preview.educationalExplanation}
                            </div>
                          `
                        : ''
                    }

                    <div class="sushi-card-footer">
                      ${item.category === 'decoration' ? html`<button type="button" class="sushi-btn-secondary pixel-btn" data-testid=${`preview-decoration-${item.id}`} ?disabled=${activeController.isEquipping || activeController.isBuying !== null || activeController.isCollecting} @click=${() => activeController.previewDecoration(item.id)}>Förhandsvisa i restaurangen</button>` : ''}
                      ${
                        isOwned
                          ? html`
                              <div class="sushi-status-line">
                                <span
                                  class="sushi-unlock-badge owned"
                                  data-testid="unlock-badge-${item.id}"
                                >
                                  ✓ Ägd
                                </span>
                                <span class="sushi-price-hint">Köpt (¥ ${item.priceYen})</span>
                              </div>
                              <div
                                class="sushi-owned-indicator"
                                data-testid="owned-indicator-${item.id}"
                              >
                                ${item.slotType ? (state.equipped[item.slotType] === item.id ? 'Placerad i restaurangen' : 'Ägd · Inte placerad') : 'Aktiv i restaurangen'}
                              </div>
                              <button
                                type="button"
                                class="sushi-btn-buy pixel-btn"
                                disabled
                                data-testid="buy-btn-${item.id}"
                              >
                                Ägd
                              </button>
                            `
                          : !isUnlocked
                            ? html`
                                <div class="sushi-status-line">
                                  <span
                                    class="sushi-unlock-badge locked"
                                    data-testid="unlock-badge-${item.id}"
                                  >
                                    🔒 Låst
                                  </span>
                                  <span class="sushi-req-text">
                                    Kräver Kapitel ${item.requiredLesson} ${item.requiredTierLabel}
                                    (${item.requiredPercent}%)
                                  </span>
                                </div>
                                <span class="sushi-price-hint" data-testid="locked-price-${item.id}"
                                  >Pris vid upplåsning: ¥ ${item.priceYen}</span
                                >
                                <button
                                  type="button"
                                  class="sushi-study-link-btn pixel-btn"
                                  data-testid="study-link-btn-${item.id}"
                                  @click=${() => handleNavigateToChapter(item.requiredLesson, item.targetWeekId)}
                                >
                                  Öppna Kapitel ${item.requiredLesson} →
                                </button>
                              `
                            : tier < item.requiredRestaurantTier
                              ? html`<span class="sushi-unlock-badge locked"
                                    >🔒 Renovering krävs</span
                                  ><button
                                    type="button"
                                    class="sushi-btn-buy pixel-btn"
                                    data-testid="buy-btn-${item.id}"
                                    disabled
                                  >
                                    Renovera först · nivå ${item.requiredRestaurantTier}
                                  </button>`
                              : !canAffordItem
                                ? html`
                                    <div class="sushi-status-line">
                                      <span
                                        class="sushi-unlock-badge unlocked"
                                        data-testid="unlock-badge-${item.id}"
                                      >
                                        ◷ Spara yen
                                      </span>
                                      <span class="sushi-price-hint"
                                        >Pris i butik: ¥ ${item.priceYen}</span
                                      >
                                    </div>
                                    <div class="sushi-status-line">
                                      <span
                                        class="sushi-missing-funds"
                                        data-testid="missing-funds-${item.id}"
                                      >
                                        Saknar ¥ ${diffYen}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      class="sushi-btn-buy pixel-btn"
                                      disabled
                                      data-testid="buy-btn-${item.id}"
                                    >
                                      För lite yen (saknar ¥ ${diffYen})
                                    </button>
                                  `
                                : html`
                                    <div class="sushi-status-line">
                                      <span
                                        class="sushi-unlock-badge unlocked"
                                        data-testid="unlock-badge-${item.id}"
                                      >
                                        ✓ Kan köpas
                                      </span>
                                      <span class="sushi-price-hint"
                                        >Pris i butik: ¥ ${item.priceYen}</span
                                      >
                                    </div>
                                    <button
                                      type="button"
                                      class="sushi-btn-buy sushi-btn-primary pixel-btn"
                                      data-testid="buy-btn-${item.id}"
                                      ?disabled=${activeController.isBuying !== null || activeController.isCollecting || activeController.isEquipping}
                                      @click=${() => void activeController.buy(item.id)}
                                    >
                                      ${
                                        activeController.isBuying === item.id
                                          ? 'Köper...'
                                          : `Köp för ¥ ${item.priceYen}`
                                      }
                                    </button>
                                  `
                      }
                    </div>
                  </div>
                `;
              })}
            </div>
          </div>
        </section>

        <!-- In-Game Pop-up Overlay 2: Meny & Inredning (Personalisering) -->
        <div
          class="sushi-scene-placeholder sushi-overlay-window ${activeController.activeOverlay === 'menu' ? 'is-open' : 'is-closed'}"
          data-testid="sushi-scene-placeholder"
          role="dialog"
          aria-modal="true"
          aria-label="Restaurangens meny och inredning"
          ?data-open=${activeController.activeOverlay === 'menu'}
        >
          <div class="sushi-overlay-header">
            <h3>Din restaurang</h3>
            <button
              type="button"
              class="sushi-overlay-close pixel-btn"
              data-testid="sushi-close-menu-btn"
              @click=${() => activeController.closeOverlay()}
              aria-label="Stäng menyfönstret"
            >
              ${renderPixelIcon('close')}
            </button>
          </div>
          <div class="sushi-menu-tabs" role="tablist" aria-label="Restaurangens avdelningar">
            ${MENU_SECTIONS.map(
              (section) =>
                html`<button
                  type="button"
                  role="tab"
                  class="sushi-filter-tab pixel-btn ${activeController.menuSection === section.id ? 'is-active' : ''}"
                  id=${`sushi-menu-tab-${section.id}`}
                  aria-controls=${`sushi-menu-panel-${section.id}`}
                  aria-selected=${activeController.menuSection === section.id}
                  tabindex=${activeController.menuSection === section.id ? 0 : -1}
                  @click=${() => activeController.setMenuSection(section.id)}
                  @keydown=${(event: KeyboardEvent) => {
                    const index = MENU_SECTIONS.findIndex((entry) => entry.id === section.id);
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? MENU_SECTIONS.length - 1
                          : event.key === 'ArrowRight'
                            ? (index + 1) % MENU_SECTIONS.length
                            : event.key === 'ArrowLeft'
                              ? (index + MENU_SECTIONS.length - 1) % MENU_SECTIONS.length
                              : -1;
                    if (next >= 0) {
                      event.preventDefault();
                      activeController.setMenuSection(MENU_SECTIONS[next].id, true);
                    }
                  }}
                >
                  ${section.label}
                </button>`,
            )}
          </div>
          <div class="sushi-overlay-scroll-body">
            <section
              class="sushi-menu-panel"
              role="tabpanel"
              id="sushi-menu-panel-memories"
              tabindex="0"
              aria-labelledby="sushi-menu-tab-memories"
              ?hidden=${activeController.menuSection !== 'memories'}
            >
              <div class="sushi-scene-badge">🍣 Personlig restaurang i drift</div>
              <p class="sushi-scene-desc">
                Restaurangen har kökskapacitet ${state ? state.kitchenCapacity : 1} och
                servicekapacitet ${state ? state.serviceCapacity : 2}. Restaurangen sparar
                automatiskt intäkter upp till ${capHoursStr} timmar även när du inte är inloggad.
              </p>
              <p class="sushi-companion-intro">
                Intjäningen börjar när din restaurang skapas. Grundkassan rymmer
                ${DEFAULT_CAP_MS / 3_600_000} timmars produktion, så att du kan studera i din egen
                takt.
              </p>
              ${renderChapterHonors(state, handleNavigateToChapter)}
            </section>
            <div
              class="sushi-scene-equipment sushi-menu-panel"
              data-testid="sushi-scene-equipment"
              role="tabpanel"
              id="sushi-menu-panel-menu"
              tabindex="0"
              aria-labelledby="sushi-menu-tab-menu"
              ?hidden=${activeController.menuSection !== 'menu'}
            >
              <section class="sushi-menu" aria-label="Restaurangens meny" data-testid="sushi-menu">
                <h3>På menyn</h3>
                <p>🍙 Klassisk nigiri</p>
                ${SUSHI_CATALOG.filter(
                  (item) => item.category === 'recipe' && state.inventory.includes(item.id),
                ).map(
                  (item) => html`
                    <p data-testid=${`menu-${item.id}`}>
                      <span aria-hidden="true">${item.icon}</span> ${item.name} · Köpt menyvariation
                    </p>
                  `,
                )}
                <small>Menyvariationerna är visuella och ändrar inte intäkterna.</small>
              </section>
              ${
                state?.inventory?.includes('prep_counter')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-prep-counter pixel-panel"
                      data-testid="scene-prep-counter"
                    >
                      🔪 Förbättrad beredningsbänk (+2 kök)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('conveyor_belt')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-conveyor-belt pixel-panel"
                      data-testid="scene-conveyor-belt"
                    >
                      🔄 Transportband (+2 service)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('cap_extension_12h')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-cap-extension pixel-panel"
                      data-testid="scene-cap-extension"
                    >
                      ⏰ ${capHoursStr}h produktionstid
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('precision_knife')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-precision-knife pixel-panel"
                      data-testid="scene-precision_knife"
                    >
                      🔪 Precisionskniv (+1 kök)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('service_counter')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-service-counter pixel-panel"
                      data-testid="scene-service_counter"
                    >
                      🍱 Utökad serveringsdisk (+2 service)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('sous_chef')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-sous-chef pixel-panel"
                      data-testid="scene-sous_chef"
                    >
                      👨‍🍳 Souschef (+2 kök)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('master_license')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-master-license pixel-panel"
                      data-testid="scene-master_license"
                    >
                      📜 Mästarcertifiering
                      (+${getCatalogItem('master_license')?.averageRevenueDelta ?? 0} ¥/order)
                    </div>`
                  : ''
              }
            </div>
            <section
              class="sushi-decorations sushi-menu-panel"
              aria-label="Dekorationsplatser"
              aria-busy=${activeController.isEquipping}
              role="tabpanel"
              id="sushi-menu-panel-decoration"
              tabindex="0"
              aria-labelledby="sushi-menu-tab-decoration"
              ?hidden=${activeController.menuSection !== 'decoration'}
            >
              <h3>Gör restaurangen personlig</h3>
              <p>
                Köp dekorationer i butiken och välj vad som ska visas här. Dekorationerna påverkar
                inte intäkterna.
              </p>
              <div class="sushi-decoration-slots">
                ${(['wallSlot', 'floorSlot'] as const).map((slot) => {
                  const label = slot === 'wallSlot' ? 'Väggplats' : 'Golvplats';
                  const selected = state.equipped[slot];
                  const item = selected ? getCatalogItem(selected) : undefined;
                  const owned = SUSHI_CATALOG.filter(
                    (entry) =>
                      entry.category === 'decoration' &&
                      entry.slotType === slot &&
                      state.inventory.includes(entry.id),
                  );
                  return html`<div
                    class="sushi-decoration-slot pixel-panel"
                    data-testid=${`decoration-${slot}`}
                  >
                    <div class="sushi-decoration-display" data-testid=${`placed-${slot}`}>
                      <span aria-hidden="true"
                        >${item?.id === 'potted_plant' ? '🌿' : (item?.icon ?? (slot === 'wallSlot' ? '🖼️' : '▫️'))}</span
                      >
                      <strong>${label}: ${item?.name ?? 'Tom plats'}</strong>
                    </div>
                    <details>
                      <summary>Ändra ${label.toLowerCase()}</summary>
                      <div class="sushi-decoration-choices">
                        ${
                          owned.length === 0
                            ? html`<p>Du äger ännu ingen dekoration för denna plats.</p>
                                <button
                                  type="button"
                                  class="sushi-btn-secondary pixel-btn"
                                  data-testid=${`decoration-shop-${slot}`}
                                  @click=${() => activeController.openDecorationShop()}
                                >
                                  Se dekorationer i butiken
                                </button>`
                            : ''
                        }
                        ${owned.map(
                          (entry) =>
                            html`<button
                              type="button"
                              class="sushi-btn-secondary pixel-btn"
                              aria-pressed=${selected === entry.id}
                              ?disabled=${activeController.isEquipping || activeController.isBuying !== null || activeController.isCollecting}
                              @click=${() => void activeController.equip(slot, entry.id)}
                            >
                              Placera ${entry.name}
                            </button>`,
                        )}
                        <button
                          type="button"
                          class="sushi-btn-secondary pixel-btn"
                          ?disabled=${!selected || activeController.isEquipping || activeController.isBuying !== null || activeController.isCollecting}
                          @click=${() => void activeController.equip(slot, null)}
                        >
                          Ta bort från ${label.toLowerCase()}
                        </button>
                      </div>
                    </details>
                  </div>`;
                })}
              </div>
              ${activeController.isEquipping ? html`<p role="status">Sparar dekorationsval…</p>` : ''}
              ${activeController.equipError ? html`<p role="alert" data-testid="sushi-equip-error">${activeController.equipError}</p>` : ''}
            </section>
            <section
              class="sushi-menu-panel"
              role="tabpanel"
              id="sushi-menu-panel-projects"
              tabindex="0"
              aria-labelledby="sushi-menu-tab-projects"
              ?hidden=${activeController.menuSection !== 'projects'}
            >
              ${renderRestaurantProjects(
                state,
                activeController.isBuying !== null ||
                  activeController.isCollecting ||
                  activeController.isEquipping,
                activeController.buildingProjectId,
                activeController.projectError,
                {
                  buy: (id) => void activeController.buyProject(id),
                  study: handleNavigateToChapter,
                },
              )}
            </section>
          </div>
        </div>

        ${
          activeController.showFinale
            ? renderRestaurantFinale(
                () => {
                  activeController.dismissFinale();
                  onBackToStudies();
                },
                () => activeController.dismissFinale(),
              )
            : ''
        }

        <!-- Åtgärder och navigation -->
        <div class="sushi-stage-actions">
          <button
            type="button"
            class="sushi-btn-secondary pixel-btn"
            data-testid="sushi-stage-back-btn"
            @click=${onBackToStudies}
          >
            ← Återgå till studierna
          </button>
        </div>

        <!-- ARIA live announcer för skärmläsare -->
        <div
          class="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="sushi-live-announcer"
        >
          ${activeController.announcement}
        </div>
      </section>
    </div>
  `;
}

/**
 * Huvudkomponent för sushispelets skal.
 * Ersätter hela studieappens toppmeny och sidomeny med ett eget renodlat spelgränssnitt.
 */
export function renderSushiShell(
  host: CourseHostContext,
  onBackToStudies: () => void,
  courseProgressSnapshot?: CourseProgressData | null,
  onNavigateToChapter?: (lessonNumber: number, weekId: string) => void,
): TemplateResult {
  const user = host.user;
  const isAuthed = isAuthenticatedGoogleUser(user);
  const displayName = user ? user.displayName || user.email || 'student' : 'student';

  if (!isAuthed && activeController.uid !== null) {
    activeController.reset();
  }

  return html`
    <div
      class="sushi-shell"
      data-theme=${host.theme}
      data-testid="sushi-shell"
      data-authenticated="${isAuthed ? 'true' : 'false'}"
    >
      <!-- Separat toppmeny för restaurangen (inga studiemenyer eller sidomenyer) -->
      <header class="sushi-topbar">
        <div class="sushi-topbar-inner">
          <div class="sushi-topbar-left">
            <h1 class="sushi-title">
              <img
                src="/sprites/sushi/ui/topbar_sushi.png"
                alt=""
                aria-hidden="true"
                class="sushi-brand-icon"
              />
              <span class="sushi-brand-text">Sakura Sushi</span>
              <span class="sr-only">🍣 Sushirestaurang</span>
            </h1>
          </div>

          <div class="sushi-topbar-right">
            ${
              isAuthed
                ? html`
                    <button
                      type="button"
                      class="sushi-account-btn logged-in"
                      ?disabled=${host.authBusy}
                      @click=${host.account}
                      title="Inloggad som ${displayName} · Klicka för att logga ut"
                    >
                      ${
                        user.photoURL
                          ? html`<img
                              class="sushi-avatar"
                              src=${user.photoURL}
                              alt=""
                              referrerpolicy="no-referrer"
                            />`
                          : html`<span class="sushi-avatar-fallback">
                              ${(user.displayName || user.email || 'S').trim().charAt(0).toUpperCase()}
                            </span>`
                      }
                      <span class="sushi-user-name" data-testid="sushi-user-name">
                        ${user.displayName || user.email || 'Student'}
                      </span>
                      <span class="sushi-logout-hint sr-only">(Logga ut)</span>
                    </button>
                  `
                : html`
                    <button
                      type="button"
                      class="sushi-account-btn pixel-btn"
                      ?disabled=${host.authBusy}
                      @click=${() => (host.onLogin ? host.onLogin() : host.account())}
                    >
                      Logga in
                    </button>
                  `
            }
            <button
              type="button"
              class="sushi-icon-btn sushi-symbol-btn"
              @click=${() => host.toggleTheme()}
              title=${
                host.theme === 'sakura'
                  ? 'Växla till Washi & Matcha-tema'
                  : 'Slå på Sakura / Kawaii-tema'
              }
            >
              <span aria-hidden="true"
                >${renderPixelIcon(host.theme === 'sakura' ? 'moon' : 'sun')}</span
              >
              <span class="sr-only">${host.theme === 'sakura' ? '🍵 Washi' : '🌸 Sakura'}</span>
            </button>
            ${
              isAuthed
                ? html`
                    <button
                      type="button"
                      class="sushi-hud-btn pixel-btn ${activeController.activeOverlay === 'menu' ? 'is-active' : ''}"
                      data-testid="sushi-toggle-menu"
                      @click=${() => activeController.toggleOverlay('menu')}
                      title="Öppna meny och inredning"
                      aria-expanded="${activeController.activeOverlay === 'menu'}"
                      aria-controls="sushi-scene-placeholder"
                    >
                      <img
                        src="/sprites/sushi/ui/btn_menu.png"
                        alt=""
                        aria-hidden="true"
                        class="sushi-top-btn-img"
                      />
                      <span class="sr-only">
                        <span class="sushi-btn-icon" aria-hidden="true"
                          >${renderPixelIcon('menu')}</span
                        >
                        <span>Meny</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="sushi-hud-btn sushi-symbol-btn pixel-btn ${activeController.activeOverlay === 'shop' ? 'is-active' : ''}"
                      data-testid="sushi-toggle-shop"
                      @click=${() => activeController.toggleOverlay('shop')}
                      title="Öppna butik och upplåsningar"
                      aria-expanded="${activeController.activeOverlay === 'shop'}"
                      aria-controls="sushi-unlocks-panel"
                    >
                      <span aria-hidden="true">${renderPixelIcon('store')}</span>
                      <span class="sr-only">
                        <span class="sushi-btn-icon" aria-hidden="true"
                          >${renderPixelIcon('store')}</span
                        >
                        <span>Butik</span>
                      </span>
                    </button>
                  `
                : ''
            }
            <button
              type="button"
              class="sushi-back-btn"
              data-testid="sushi-back-to-studies"
              @click=${onBackToStudies}
              title="Tillbaka till studierna"
            >
              <img
                src="/sprites/sushi/ui/btn_book.png"
                alt=""
                aria-hidden="true"
                class="sushi-top-btn-img"
              />
              <span class="sr-only">
                <span class="sushi-btn-icon" aria-hidden="true"
                  >${renderPixelIcon('arrow-left')}</span
                >
                <span>← Tillbaka till studierna</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <!-- Huvudyta: Auth Gate för oinloggade, Spelscen för inloggade -->
      <main class="sushi-main" id="sushi-main">
        ${
          isAuthed
            ? renderSushiAuthenticatedStage(
                host,
                user,
                onBackToStudies,
                courseProgressSnapshot,
                onNavigateToChapter,
              )
            : renderSushiAuthGate(host, onBackToStudies)
        }
      </main>
    </div>
  `;
}
