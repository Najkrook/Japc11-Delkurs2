import { generateArenaQuestionDeck } from './arena-questions.ts';
import { cloudArenaStore, localArenaStore, type ArenaStore } from './arena-store.ts';
import type {
  ArenaOpenRoomSummary,
  ArenaPlayer,
  ArenaRoomConfig,
  ArenaRoomDoc,
} from './arena-types.ts';
import { ArenaMatch, ARENA_BOT_PRESETS } from './arena-match.ts';
import { systemArenaRuntime, type ArenaRuntime } from './arena-runtime.ts';
import { ensureAnonymousAuth } from '../../cloud.ts';
export { ARENA_BOT_PRESETS, type BotPreset } from './arena-match.ts';

async function defaultEnsureAuth(): Promise<string | null> {
  if (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    !process.env.FIRESTORE_EMULATOR_HOST &&
    !process.env.FIREBASE_AUTH_EMULATOR_HOST
  ) {
    return null;
  }
  const user = await ensureAnonymousAuth().catch(() => null);
  return user?.uid || null;
}

export function generateRoomCode(random: () => number = Math.random): string {
  return String(Math.floor(1000 + random() * 9000));
}

export class CourseArenaManager {
  private room: ArenaRoomDoc | null = null;
  private openRooms: ArenaOpenRoomSummary[] = [];
  private localPlayerUid = '';
  private localPlayerName = 'Spelare';
  private guestUid = '';
  private isLoggedIn = false;
  private identity: string | null | undefined;
  private generation = 0;
  private draftConfig: ArenaRoomConfig = {
    weekFilter: 'week-1',
    focusMode: 'mix',
    roundCount: 10,
    roundDurationSeconds: 15,
  };
  private joinCodeInput = '';
  private errorMessage = '';
  private match: ArenaMatch;
  private runtime: ArenaRuntime;
  private roomUnsub: (() => void) | null = null;
  private openRoomsUnsub: (() => void) | null = null;
  private onUpdateCallback: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();
  private store: ArenaStore = localArenaStore;
  private storeFactory: (loggedIn: boolean) => ArenaStore;
  private ensureAuth: () => Promise<string | null>;

  constructor(
    storeFactory = (loggedIn: boolean) => (loggedIn ? cloudArenaStore : localArenaStore),
    runtime: ArenaRuntime = systemArenaRuntime,
    ensureAuth: () => Promise<string | null> = defaultEnsureAuth,
  ) {
    this.storeFactory = storeFactory;
    this.runtime = runtime;
    this.ensureAuth = ensureAuth;
    this.match = new ArenaMatch(
      runtime,
      (transition) => this.change(transition),
      () => this.notify(),
    );
  }

  public bindHost(
    user: { uid: string; displayName?: string | null; email?: string | null } | null,
    onUpdate: () => void,
  ): void {
    this.onUpdateCallback = onUpdate;
    const identity = user?.uid || null;
    if (this.identity !== identity) {
      this.generation++;
      this.resetRoom();
      this.openRoomsUnsub?.();
      this.openRoomsUnsub = null;
      this.openRooms = [];
      this.identity = identity;
      this.isLoggedIn = Boolean(identity);
      this.store = this.storeFactory(this.isLoggedIn);
      if (!this.guestUid) {
        try {
          this.guestUid = sessionStorage.getItem('tentaplugg-arena-guest-uid') || '';
        } catch {
          /* Storage may be blocked. */
        }
        if (!this.guestUid) this.guestUid = `guest-${crypto.randomUUID()}`;
        try {
          sessionStorage.setItem('tentaplugg-arena-guest-uid', this.guestUid);
        } catch {
          /* Keep the in-memory guest identity. */
        }
      }
      this.localPlayerUid = identity || this.guestUid;
      this.localPlayerName = user
        ? user.displayName || user.email?.split('@')[0] || 'Kursdeltagare'
        : 'Spelare';
      this.errorMessage = '';
    }
    if (!this.openRoomsUnsub) {
      this.startWatchingOpenRooms();
    }
  }

  private startWatchingOpenRooms(): void {
    this.openRoomsUnsub?.();
    this.openRoomsUnsub = null;
    const generation = this.generation;
    this.openRoomsUnsub = this.store.watchOpen(
      (rooms) => {
        if (generation !== this.generation) return;
        this.openRooms = rooms
          .map((r) => ({
            roomId: r.roomId,
            roomCode: r.roomCode,
            hostName: r.hostName,
            weekFilter: r.config.weekFilter,
            focusMode: r.config.focusMode,
            roundCount: r.questions.length,
            playerCount: Object.keys(r.players).length,
            createdAt: r.createdAt,
          }))
          .sort((a, b) => b.createdAt - a.createdAt);
        // Defer synchronous store delivery until lifecycle binding has completed.
        queueMicrotask(() => {
          if (generation === this.generation) this.notify();
        });
      },
      () => {
        if (!this.isLoggedIn && this.store !== localArenaStore) {
          this.store = localArenaStore;
          this.startWatchingOpenRooms();
        } else {
          this.fail('Kunde inte hämta rum. Kontrollera anslutningen.');
        }
      },
    );
  }

  public getState() {
    const timeRemainingMs = this.match.remainingMs();
    return {
      room: this.room,
      openRooms: this.openRooms,
      localPlayerUid: this.localPlayerUid,
      localPlayerName: this.localPlayerName,
      isLoggedIn: this.isLoggedIn,
      draftConfig: this.draftConfig,
      joinCodeInput: this.joinCodeInput,
      errorMessage: this.errorMessage,
      timeRemainingSeconds: Math.max(0, Math.ceil(timeRemainingMs / 1000)),
      timeRemainingRatio: this.room
        ? Math.max(0, Math.min(1, timeRemainingMs / (this.room.config.roundDurationSeconds * 1000)))
        : 1,
    };
  }

  public setPlayerName(name: string): void {
    this.localPlayerName = name.trim().slice(0, 80) || 'Spelare';
    const next = this.localPlayerName;
    const uid = this.localPlayerUid;
    void this.change((room) => {
      if (room.players[uid]) room.players[uid].name = next;
    });
    this.notify();
  }

  public updateDraftConfig(
    patch: Partial<Pick<ArenaRoomConfig, 'weekFilter' | 'focusMode' | 'roundCount'>>,
  ): void {
    this.draftConfig = { ...this.draftConfig, ...patch };
    this.errorMessage = '';
    this.notify();
  }

  public setJoinCodeInput(code: string): void {
    this.joinCodeInput = code.replace(/\D+/g, '').slice(0, 4);
    this.errorMessage = '';
    this.notify();
  }

  private makePlayer(uid: string, name: string, avatar = '🐼'): ArenaPlayer {
    return {
      uid,
      name,
      avatar,
      score: 0,
      streak: 0,
      correctCount: 0,
      joinedAt: this.runtime.now(),
    };
  }

  private async prepareStoreForAction(): Promise<{ uid: string; store: ArenaStore }> {
    if (this.isLoggedIn) {
      return { uid: this.localPlayerUid, store: this.store };
    }
    const anonUid = await this.ensureAuth().catch(() => null);
    if (anonUid) {
      this.localPlayerUid = anonUid;
      const cloudStore = this.storeFactory(true);
      if (this.store !== cloudStore) {
        this.store = cloudStore;
        this.startWatchingOpenRooms();
      }
      return { uid: anonUid, store: cloudStore };
    }
    const fallbackStore = this.storeFactory(false);
    this.store = fallbackStore;
    return { uid: this.localPlayerUid || this.guestUid, store: fallbackStore };
  }

  private async performCreateRoom(
    store: ArenaStore,
    uid: string,
    withDefaultBot: boolean,
    generation: number,
  ): Promise<ArenaRoomDoc | null> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const roomCode = generateRoomCode(() => this.runtime.random());
      const now = this.runtime.now();
      const players: Record<string, ArenaPlayer> = {
        [uid]: this.makePlayer(uid, this.localPlayerName, '🦊'),
      };
      if (withDefaultBot) {
        const bot = ARENA_BOT_PRESETS[0];
        players[bot.id] = {
          ...this.makePlayer(bot.id, bot.name, bot.avatar),
          isBot: true,
          botSkill: bot.skill,
        };
      }
      const candidate: ArenaRoomDoc = {
        roomId: `room-${roomCode}`,
        roomCode,
        hostUid: uid,
        hostName: this.localPlayerName,
        status: 'waiting',
        config: { ...this.draftConfig },
        players,
        questions: generateArenaQuestionDeck(this.draftConfig, () => this.runtime.random()),
        currentRoundIndex: 0,
        roundStartedAt: 0,
        roundAnswers: {},
        createdAt: now,
        updatedAt: now,
      };
      let collision = false;
      const saved = await store
        .change(candidate.roomId, (existing) => {
          if (generation !== this.generation) throw new Error('session-changed');
          collision = Boolean(existing);
          if (existing) throw new Error('room-code-collision');
          return candidate;
        })
        .catch((error) => {
          if (collision) return null;
          throw error;
        });
      if (generation !== this.generation) return null;
      if (!saved) continue;
      this.accept(saved);
      this.subscribe(saved.roomId);
      return saved;
    }
    this.fail('Kunde inte hitta en ledig rumskod. Försök igen.');
    return null;
  }

  public async createRoom(withDefaultBot = false): Promise<ArenaRoomDoc | null> {
    if (this.room) {
      await this.leaveRoom();
      if (this.room) return null;
    }
    const generation = this.generation;
    this.errorMessage = '';
    const { uid, store } = await this.prepareStoreForAction();
    if (generation !== this.generation) return null;

    try {
      const room = await this.performCreateRoom(store, uid, withDefaultBot, generation);
      if (room) return room;
    } catch {
      if (!this.isLoggedIn && store !== localArenaStore) {
        try {
          this.store = localArenaStore;
          this.localPlayerUid = this.guestUid;
          const fallbackRoom = await this.performCreateRoom(
            localArenaStore,
            this.guestUid,
            withDefaultBot,
            generation,
          );
          if (fallbackRoom) return fallbackRoom;
        } catch {
          /* Fall through */
        }
      }
      this.fail('Rummet kunde inte sparas. Kontrollera anslutningen och försök igen.');
    }
    return null;
  }

  public async joinRoomByCode(rawCode?: string): Promise<boolean> {
    const code = (rawCode ?? this.joinCodeInput).trim();
    if (!/^\d{4}$/.test(code)) {
      this.fail('Ange en 4-siffrig rumskod.');
      return false;
    }
    return this.joinRoomById(`room-${code}`);
  }

  public async joinRoomById(roomId: string): Promise<boolean> {
    if (this.room && this.room.roomId !== roomId) {
      await this.leaveRoom();
      if (this.room) return false;
    }
    const generation = this.generation;
    const { uid, store } = await this.prepareStoreForAction();
    if (generation !== this.generation) return false;

    const player = this.makePlayer(uid, this.localPlayerName);
    try {
      const room = await store.change(roomId, (current) => {
        if (generation !== this.generation) throw new Error('session-changed');
        if (!current) throw new Error('missing');
        if (!current.players[uid]) {
          if (current.status !== 'waiting') throw new Error('already-started');
          current.players[uid] = player;
          current.updatedAt = Math.max(this.runtime.now(), current.updatedAt + 1);
        }
        return current;
      });
      if (generation !== this.generation || !room) return false;
      this.errorMessage = '';
      this.accept(room);
      this.subscribe(roomId);
      return true;
    } catch {
      if (!this.isLoggedIn && store !== localArenaStore) {
        try {
          this.store = localArenaStore;
          this.localPlayerUid = this.guestUid;
          const localPlayer = this.makePlayer(this.guestUid, this.localPlayerName);
          const localRoom = await localArenaStore.change(roomId, (current) => {
            if (generation !== this.generation) throw new Error('session-changed');
            if (!current) throw new Error('missing');
            if (!current.players[this.guestUid]) {
              if (current.status !== 'waiting') throw new Error('already-started');
              current.players[this.guestUid] = localPlayer;
              current.updatedAt = Math.max(this.runtime.now(), current.updatedAt + 1);
            }
            return current;
          });
          if (generation === this.generation && localRoom) {
            this.errorMessage = '';
            this.accept(localRoom);
            this.subscribe(roomId);
            return true;
          }
        } catch {
          /* Fall through */
        }
      }
      this.fail(
        'Kunde inte ansluta. Rummet kan vara stängt, matchen startad eller anslutningen bruten.',
      );
      return false;
    }
  }

  public async toggleBot(botId: string): Promise<void> {
    const bot = ARENA_BOT_PRESETS.find((b) => b.id === botId);
    if (!bot) return;
    await this.change((room) => {
      this.requireHost(room);
      if (room.status !== 'waiting') return;
      if (room.players[botId]) delete room.players[botId];
      else
        room.players[botId] = {
          ...this.makePlayer(bot.id, bot.name, bot.avatar),
          isBot: true,
          botSkill: bot.skill,
        };
    });
  }

  public async startMatch(): Promise<void> {
    await this.change(this.match.start(this.room?.config || this.draftConfig, this.localPlayerUid));
  }

  public async submitAnswer(choice: string): Promise<void> {
    await this.change(this.match.answer(this.localPlayerUid, this.localPlayerUid, choice));
  }

  public async nextRound(): Promise<void> {
    await this.change(this.match.next(this.localPlayerUid));
  }

  public async leaveRoom(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const uid = this.localPlayerUid;
    const generation = this.generation;
    try {
      await this.store.change(room.roomId, (current) => {
        if (!current || current.hostUid === uid) return null;
        delete current.players[uid];
        current.updatedAt = Math.max(this.runtime.now(), current.updatedAt + 1);
        return current;
      });
      if (generation !== this.generation) return;
      this.resetRoom();
      this.notify();
    } catch {
      this.fail('Kunde inte lämna rummet. Kontrollera anslutningen och försök igen.');
    }
  }

  public dispose(): void {
    this.generation++;
    this.resetRoom();
    this.openRoomsUnsub?.();
    this.openRoomsUnsub = null;
    this.onUpdateCallback = null;
  }

  private requireHost(room: ArenaRoomDoc): void {
    if (room.hostUid !== this.localPlayerUid) throw new Error('host-only');
  }

  private async change(update: (room: ArenaRoomDoc) => void): Promise<void> {
    const id = this.room?.roomId;
    if (!id) return;
    const generation = this.generation;
    try {
      const room = await this.store.change(id, (current) => {
        if (generation !== this.generation) throw new Error('session-changed');
        if (!current) return null;
        const serializedBefore = JSON.stringify(current);
        update(current);
        if (JSON.stringify(current) === serializedBefore) return current;
        current.updatedAt = Math.max(this.runtime.now(), current.updatedAt + 1);
        return current;
      });
      if (generation !== this.generation || this.room?.roomId !== id) return;
      this.errorMessage = '';
      this.accept(room);
    } catch {
      if (generation === this.generation)
        this.fail(
          'Ändringen kunde inte sparas. Kontrollera anslutningen och att du har rätt behörighet.',
        );
    }
  }

  private subscribe(id: string): void {
    this.roomUnsub?.();
    const generation = this.generation;
    this.roomUnsub = this.store.watch(
      id,
      (room) => {
        if (generation === this.generation && this.room?.roomId === id) this.accept(room);
      },
      () => this.fail('Kontakten med rummet bröts. Försök ansluta igen.'),
    );
  }

  private accept(room: ArenaRoomDoc | null): void {
    if (!room) {
      this.resetRoom();
      this.notify();
      return;
    }
    if (this.room?.roomId === room.roomId && this.room.updatedAt > room.updatedAt) return;
    this.room = room;
    this.match.observe(room, this.localPlayerUid);
    this.notify();
  }

  private resetRoom(): void {
    this.roomUnsub?.();
    this.roomUnsub = null;
    this.room = null;
    this.match.reset();
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.notify();
  }
  public onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.onUpdateCallback?.();
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* ignore subscriber error */
      }
    });
  }
}

export const courseArenaManager = new CourseArenaManager();
