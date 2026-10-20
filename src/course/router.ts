import type { CourseHostContext, CourseSubView } from './types.ts';
import { courseWeeks } from './data/index.ts';
import { courseProgress as defaultCourseProgress } from './course-view.ts';
import { courseArenaManager as defaultArenaManager } from './multiplayer/arena-service.ts';
import { loadExtraStudiesModule } from './course-view.ts';

export interface CourseRoute {
  weekId: string;
  subView: CourseSubView;
  arenaRoomCode?: string;
}

const VALID_WEEKS = new Set(courseWeeks.map((w) => w.id));

const VALID_SUBVIEWS = new Set<CourseSubView>([
  'hub',
  'vocab',
  'grammar',
  'dojo',
  'kanji',
  'quiz',
  'arena',
  'extra',
]);

const SUBVIEW_ALIASES: Record<string, CourseSubView> = {
  hub: 'hub',
  oversikt: 'hub',
  översikt: 'hub',
  vocab: 'vocab',
  glosor: 'vocab',
  grammar: 'grammar',
  grammatik: 'grammar',
  dojo: 'dojo',
  'te-form': 'dojo',
  'te-form-dojo': 'dojo',
  kanji: 'kanji',
  quiz: 'quiz',
  tenta: 'quiz',
  tentafokus: 'quiz',
  arena: 'arena',
  extra: 'extra',
};

function normalizeWeekId(raw: string, fallback: string): string {
  const clean = raw.trim().toLowerCase();
  if (VALID_WEEKS.has(clean)) {
    return clean;
  }
  const numMatch = clean.match(/^week-(\d+)$/) || clean.match(/^(\d+)$/);
  if (numMatch) {
    const candidate = `week-${numMatch[1]}`;
    if (VALID_WEEKS.has(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

function normalizeSubView(raw?: string): CourseSubView {
  if (!raw) return 'hub';
  const clean = raw.trim().toLowerCase();
  if (clean in SUBVIEW_ALIASES) {
    return SUBVIEW_ALIASES[clean];
  }
  if (VALID_SUBVIEWS.has(clean as CourseSubView)) {
    return clean as CourseSubView;
  }
  return 'hub';
}

/**
 * Parses an URL hash string into a structured CourseRoute.
 * Examples:
 *   - '#/vecka/week-1' -> { weekId: 'week-1', subView: 'hub' }
 *   - '#/vecka/week-2/dojo' -> { weekId: 'week-2', subView: 'dojo' }
 *   - '#/vecka/week-3/vocab' -> { weekId: 'week-3', subView: 'vocab' }
 *   - '#/arena' -> { weekId: fallback, subView: 'arena' }
 *   - '#/arena/1234' -> { weekId: fallback, subView: 'arena', arenaRoomCode: '1234' }
 *   - '#/extra' -> { weekId: fallback, subView: 'extra' }
 */
export function parseRoute(hash: string, fallbackWeekId = 'week-1'): CourseRoute {
  const fallback = normalizeWeekId(fallbackWeekId, 'week-1');
  const clean = (hash || '').trim().replace(/^#+/, '').replace(/^\/+/, '');
  if (!clean) {
    return { weekId: fallback, subView: 'hub' };
  }

  const parts = clean
    .split('/')
    .map((p) => decodeURIComponent(p).trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    return { weekId: fallback, subView: 'hub' };
  }

  const first = parts[0];

  // Pattern: #/arena or #/arena/1234
  if (first === 'arena') {
    let arenaRoomCode: string | undefined;
    if (parts.length > 1 && parts[1]) {
      const codeCandidate = parts[1].replace(/^room-/, '').trim();
      const codeMatch = codeCandidate.match(/\d{4}/);
      arenaRoomCode = codeMatch ? codeMatch[0] : codeCandidate;
    }
    return {
      weekId: fallback,
      subView: 'arena',
      ...(arenaRoomCode ? { arenaRoomCode } : {}),
    };
  }

  // Pattern: #/extra
  if (first === 'extra') {
    return {
      weekId: fallback,
      subView: 'extra',
    };
  }

  // Pattern: #/vecka/:weekId or #/vecka/:weekId/:subView or #/week/:weekId
  if (first === 'vecka' || first === 'week') {
    const rawWeek = parts[1] || '';
    const weekId = normalizeWeekId(rawWeek, fallback);
    const subView = normalizeSubView(parts[2]);
    return { weekId, subView };
  }

  // Pattern: #/week-1/dojo
  if (first.startsWith('week-')) {
    const weekId = normalizeWeekId(first, fallback);
    const subView = normalizeSubView(parts[1]);
    return { weekId, subView };
  }

  // Direct subviews or aliases: #/vocab, #/dojo, #/glosor, etc.
  if (first in SUBVIEW_ALIASES) {
    const subView = SUBVIEW_ALIASES[first];
    return { weekId: fallback, subView };
  }

  return { weekId: fallback, subView: 'hub' };
}

/**
 * Formats a CourseRoute into its canonical hash representation.
 */
export function formatRoute(route: CourseRoute): string {
  if (route.subView === 'arena') {
    return route.arenaRoomCode ? `#/arena/${route.arenaRoomCode}` : '#/arena';
  }
  if (route.subView === 'extra') {
    return '#/extra';
  }
  if (route.subView === 'hub') {
    return `#/vecka/${route.weekId}`;
  }
  return `#/vecka/${route.weekId}/${route.subView}`;
}

export function normalizeHash(hash: string, fallbackWeekId = 'week-1'): string {
  return formatRoute(parseRoute(hash, fallbackWeekId));
}

export interface CourseRouterProgressStore {
  snapshot: () => { activeWeekId: string; activeSubView: CourseSubView };
  update: (
    command: { type: 'week'; weekId: string } | { type: 'subview'; subView: CourseSubView },
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface CourseRouterArenaManager {
  getState: () => {
    room: { roomCode: string } | null;
    joinCodeInput: string;
  };
  setJoinCodeInput: (code: string) => void;
  leaveRoom: () => Promise<void>;
  onStateChange: (listener: () => void) => () => void;
}

export interface CourseRouterOptions {
  progress?: CourseRouterProgressStore;
  arenaManager?: CourseRouterArenaManager;
  host?: CourseHostContext;
  windowObj?: Window;
}

export class CourseRouter {
  private progress: CourseRouterProgressStore;
  private arenaManager: CourseRouterArenaManager;
  private host?: CourseHostContext;
  private windowObj: Window;

  private isApplyingFromHash = false;
  private isApplyingToHash = false;
  private pendingUrlRoomCode: string | null = null;
  private hashListener: (() => void) | null = null;
  private progressUnsub: (() => void) | null = null;
  private arenaUnsub: (() => void) | null = null;

  constructor(options?: CourseRouterOptions) {
    this.progress = options?.progress ?? defaultCourseProgress;
    this.arenaManager = options?.arenaManager ?? defaultArenaManager;
    this.host = options?.host;
    this.windowObj =
      options?.windowObj ?? (typeof window !== 'undefined' ? window : ({} as Window));
  }

  public init(): void {
    if (!this.windowObj || typeof this.windowObj.addEventListener !== 'function') {
      return;
    }

    // 1. Listen for browser hash changes (Back/Forward buttons or direct anchor clicks)
    this.hashListener = () => this.syncFromHash();
    this.windowObj.addEventListener('hashchange', this.hashListener);

    // 2. Listen for courseProgress updates (clicking tabs, subviews, etc.)
    this.progressUnsub = this.progress.subscribe(() => {
      this.syncToHash(false);
    });

    // 3. Listen for arena state changes (creating room, leaving room, etc.)
    this.arenaUnsub = this.arenaManager.onStateChange(() => {
      if (this.progress.snapshot().activeSubView === 'arena') {
        this.syncToHash(false);
      }
    });

    // 4. Initial synchronization on page load
    const currentHash = this.windowObj.location?.hash || '';
    if (currentHash && currentHash !== '#' && currentHash !== '#/') {
      this.syncFromHash();
      // Ensure the URL in the address bar is normalized without adding an extra history entry
      const snapshot = this.progress.snapshot();
      const arenaState = this.arenaManager.getState();
      const route = parseRoute(currentHash, snapshot.activeWeekId);
      const canonical = formatRoute({
        weekId: snapshot.activeWeekId,
        subView: snapshot.activeSubView,
        arenaRoomCode:
          snapshot.activeSubView === 'arena'
            ? arenaState.room?.roomCode || route.arenaRoomCode
            : undefined,
      });
      if (this.windowObj.location?.hash !== canonical && this.windowObj.history?.replaceState) {
        this.windowObj.history.replaceState(null, '', canonical);
      }
    } else {
      // Empty or bare '#' -> replace with default canonical hash so Back button doesn't leave the app
      this.syncToHash(true);
    }
  }

  public syncFromHash(): void {
    if (this.isApplyingToHash || this.isApplyingFromHash) return;
    this.isApplyingFromHash = true;
    try {
      const currentHash = this.windowObj.location?.hash || '';
      const currentSnapshot = this.progress.snapshot();
      const route = parseRoute(currentHash, currentSnapshot.activeWeekId);

      // Arena room code handling
      if (route.subView === 'arena') {
        const arenaState = this.arenaManager.getState();
        if (route.arenaRoomCode) {
          this.pendingUrlRoomCode = route.arenaRoomCode;
          if (arenaState.joinCodeInput !== route.arenaRoomCode) {
            this.arenaManager.setJoinCodeInput(route.arenaRoomCode);
          }
        } else {
          this.pendingUrlRoomCode = null;
          if (arenaState.room) {
            // If hash navigated back to #/arena while still in a room, leave the room
            void this.arenaManager.leaveRoom();
          }
        }
      } else {
        this.pendingUrlRoomCode = null;
      }

      const weekChanged = route.weekId !== currentSnapshot.activeWeekId;
      const subViewChanged = route.subView !== currentSnapshot.activeSubView;

      if (weekChanged) {
        this.progress.update({ type: 'week', weekId: route.weekId });
      }
      if (subViewChanged) {
        this.progress.update({ type: 'subview', subView: route.subView });
        if (route.subView === 'extra') {
          loadExtraStudiesModule(this.host).catch(() => {});
        }
      }
      if (weekChanged || subViewChanged) {
        this.host?.render();
      }
    } finally {
      this.isApplyingFromHash = false;
    }
  }

  public syncToHash(replace = false): void {
    if (this.isApplyingFromHash || this.isApplyingToHash) return;
    const snapshot = this.progress.snapshot();
    const arenaState = this.arenaManager.getState();

    let arenaRoomCode: string | undefined;
    if (snapshot.activeSubView === 'arena') {
      if (arenaState.room?.roomCode) {
        this.pendingUrlRoomCode = null;
        arenaRoomCode = arenaState.room.roomCode;
      } else if (this.pendingUrlRoomCode) {
        arenaRoomCode = this.pendingUrlRoomCode;
      }
    } else {
      this.pendingUrlRoomCode = null;
    }

    const targetHash = formatRoute({
      weekId: snapshot.activeWeekId,
      subView: snapshot.activeSubView,
      arenaRoomCode,
    });

    const currentHash = this.windowObj.location?.hash || '';
    if (currentHash === targetHash) return;

    this.isApplyingToHash = true;
    try {
      if (replace && this.windowObj.history?.replaceState) {
        this.windowObj.history.replaceState(null, '', targetHash);
      } else if (this.windowObj.location) {
        this.windowObj.location.hash = targetHash;
      }
    } finally {
      this.isApplyingToHash = false;
    }
  }

  public navigate(route: Partial<CourseRoute>, replace = false): void {
    const current = this.progress.snapshot();
    const nextRoute: CourseRoute = {
      weekId: route.weekId || current.activeWeekId,
      subView: route.subView || current.activeSubView,
      arenaRoomCode: route.arenaRoomCode,
    };
    const targetHash = formatRoute(nextRoute);
    if (replace && this.windowObj.history?.replaceState) {
      this.windowObj.history.replaceState(null, '', targetHash);
      this.syncFromHash();
    } else if (this.windowObj.location) {
      this.windowObj.location.hash = targetHash;
    }
  }

  public destroy(): void {
    if (
      this.hashListener &&
      this.windowObj &&
      typeof this.windowObj.removeEventListener === 'function'
    ) {
      this.windowObj.removeEventListener('hashchange', this.hashListener);
      this.hashListener = null;
    }
    if (this.progressUnsub) {
      this.progressUnsub();
      this.progressUnsub = null;
    }
    if (this.arenaUnsub) {
      this.arenaUnsub();
      this.arenaUnsub = null;
    }
  }
}

export function initCourseRouter(options?: CourseRouterOptions): CourseRouter | null {
  const win = options?.windowObj ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win || typeof win.addEventListener !== 'function') {
    return null;
  }
  const router = new CourseRouter({ ...options, windowObj: win });
  router.init();
  return router;
}
