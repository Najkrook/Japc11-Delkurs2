import { calculateArenaPoints, generateArenaQuestionDeck } from './arena-questions.ts';
import { cloudArenaStore, localArenaStore, type ArenaStore } from './arena-store.ts';
import type {
  ArenaOpenRoomSummary,
  ArenaPlayer,
  ArenaRoomConfig,
  ArenaRoomDoc,
} from './arena-types.ts';
export interface BotPreset {
  id: string;
  name: string;
  avatar: string;
  skill: 'chill' | 'steady' | 'sensei';
  accuracy: number;
  minDelayMs: number;
  maxDelayMs: number;
  descriptionSv: string;
}

export const ARENA_BOT_PRESETS: BotPreset[] = [
  {
    id: 'bot-sakura',
    name: 'Sakura-bot',
    avatar: '🌸',
    skill: 'chill',
    accuracy: 0.72,
    minDelayMs: 1400,
    maxDelayMs: 3200,
    descriptionSv: 'Glad klasskompis · ~72% rätt',
  },
  {
    id: 'bot-kenji',
    name: 'Kenji-bot',
    avatar: '🥋',
    skill: 'steady',
    accuracy: 0.85,
    minDelayMs: 1100,
    maxDelayMs: 2500,
    descriptionSv: 'て-form-entusiast · ~85% rätt',
  },
  {
    id: 'bot-sensei',
    name: 'Sensei-bot',
    avatar: '🎓',
    skill: 'sensei',
    accuracy: 0.95,
    minDelayMs: 800,
    maxDelayMs: 1800,
    descriptionSv: 'Grammatikmästare · ~95% rätt',
  },
];

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
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
  private timeRemainingMs = 15000;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private botTimers: Array<ReturnType<typeof setTimeout>> = [];
  private timerRound = '';
  private roomUnsub: (() => void) | null = null;
  private openRoomsUnsub: (() => void) | null = null;
  private onUpdateCallback: (() => void) | null = null;
  private store: ArenaStore = localArenaStore;
  private storeFactory: (loggedIn: boolean) => ArenaStore;

  constructor(
    storeFactory = (loggedIn: boolean) => (loggedIn ? cloudArenaStore : localArenaStore),
  ) {
    this.storeFactory = storeFactory;
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
              roundCount: r.config.roundCount,
              playerCount: Object.keys(r.players).length,
              createdAt: r.createdAt,
            }))
            .sort((a, b) => b.createdAt - a.createdAt);
          // Local watchOpen may deliver synchronously while the view is rendering.
          queueMicrotask(() => {
            if (generation === this.generation) this.notify();
          });
        },
        () => this.fail('Kunde inte hämta rum. Kontrollera anslutningen.'),
      );
    }
  }

  public getState() {
    return {
      room: this.room,
      openRooms: this.openRooms,
      localPlayerUid: this.localPlayerUid,
      localPlayerName: this.localPlayerName,
      isLoggedIn: this.isLoggedIn,
      draftConfig: this.draftConfig,
      joinCodeInput: this.joinCodeInput,
      errorMessage: this.errorMessage,
      timeRemainingSeconds: Math.max(0, Math.ceil(this.timeRemainingMs / 1000)),
      timeRemainingRatio: this.room
        ? Math.max(
            0,
            Math.min(1, this.timeRemainingMs / (this.room.config.roundDurationSeconds * 1000)),
          )
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
    return { uid, name, avatar, score: 0, streak: 0, correctCount: 0, joinedAt: Date.now() };
  }

  public async createRoom(withDefaultBot = false): Promise<ArenaRoomDoc | null> {
    if (this.room) {
      await this.leaveRoom();
      if (this.room) return null;
    }
    const generation = this.generation;
    const store = this.store;
    const uid = this.localPlayerUid;
    this.errorMessage = '';
    try {
      for (let attempt = 0; attempt < 20; attempt++) {
        const roomCode = generateRoomCode();
        const now = Date.now();
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
          questions: generateArenaQuestionDeck(this.draftConfig),
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
    } catch {
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
    const uid = this.localPlayerUid;
    const player = this.makePlayer(uid, this.localPlayerName);
    try {
      const room = await this.store.change(roomId, (current) => {
        if (generation !== this.generation) throw new Error('session-changed');
        if (!current) throw new Error('missing');
        if (!current.players[uid]) {
          if (current.status !== 'waiting') throw new Error('already-started');
          current.players[uid] = player;
          current.updatedAt = Math.max(Date.now(), current.updatedAt + 1);
        }
        return current;
      });
      if (generation !== this.generation || !room) return false;
      this.errorMessage = '';
      this.accept(room);
      this.subscribe(roomId);
      return true;
    } catch {
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
    // Build once: a Firestore transaction may retry its callback.
    const questions = generateArenaQuestionDeck(this.room?.config || this.draftConfig);
    await this.change((room) => {
      this.requireHost(room);
      if (room.status !== 'waiting' && room.status !== 'finished') return;
      for (const player of Object.values(room.players)) {
        player.score = 0;
        player.streak = 0;
        player.correctCount = 0;
      }
      room.questions = questions;
      room.currentRoundIndex = 0;
      room.roundStartedAt = Date.now();
      room.roundAnswers = { '0': {} };
      room.status = 'question';
    });
  }

  public async submitAnswer(choice: string): Promise<void> {
    await this.answer(this.localPlayerUid, choice);
  }

  private async answer(uid: string, choice: string): Promise<void> {
    const expectedRound = this.room?.currentRoundIndex;
    const expectedStart = this.room?.roundStartedAt;
    await this.change((room) => {
      if (
        room.status !== 'question' ||
        room.currentRoundIndex !== expectedRound ||
        room.roundStartedAt !== expectedStart
      )
        return;
      if (
        uid !== this.localPlayerUid &&
        (room.hostUid !== this.localPlayerUid || !room.players[uid]?.isBot)
      )
        return;
      const key = String(room.currentRoundIndex);
      const q = room.questions[room.currentRoundIndex];
      const player = room.players[uid];
      if (!player || !q || !q.choices.includes(choice) || room.roundAnswers[key]?.[uid]) return;
      const now = Date.now();
      const duration = room.config.roundDurationSeconds * 1000;
      const remaining = duration - Math.max(0, now - room.roundStartedAt);
      if (remaining <= 0) return;
      const correct = choice === q.answer;
      const points = calculateArenaPoints(correct, remaining, duration, player.streak);
      room.roundAnswers[key] ||= {};
      room.roundAnswers[key][uid] = {
        choice,
        correct,
        pointsAwarded: points,
        timeRemainingMs: remaining,
        answeredAt: now,
      };
      player.score += points;
      player.streak = correct ? player.streak + 1 : 0;
      if (correct) player.correctCount++;
      if (room.hostUid === this.localPlayerUid && this.allAnswered(room)) room.status = 'reveal';
    });
  }

  public async nextRound(): Promise<void> {
    const expectedRound = this.room?.currentRoundIndex;
    const expectedStart = this.room?.roundStartedAt;
    await this.change((room) => {
      this.requireHost(room);
      if (
        room.status !== 'reveal' ||
        room.currentRoundIndex !== expectedRound ||
        room.roundStartedAt !== expectedStart
      )
        return;
      if (room.currentRoundIndex + 1 >= room.questions.length) room.status = 'finished';
      else {
        room.currentRoundIndex++;
        room.roundStartedAt = Date.now();
        room.roundAnswers[String(room.currentRoundIndex)] = {};
        room.status = 'question';
      }
    });
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
        current.updatedAt = Math.max(Date.now(), current.updatedAt + 1);
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

  private allAnswered(room: ArenaRoomDoc): boolean {
    const answers = room.roundAnswers[String(room.currentRoundIndex)] || {};
    return Object.keys(room.players).every((uid) => Boolean(answers[uid]));
  }

  private async change(update: (room: ArenaRoomDoc) => void): Promise<void> {
    const id = this.room?.roomId;
    if (!id) return;
    const generation = this.generation;
    try {
      const room = await this.store.change(id, (current) => {
        if (generation !== this.generation) throw new Error('session-changed');
        if (!current) return null;
        update(current);
        current.updatedAt = Math.max(Date.now(), current.updatedAt + 1);
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
    this.syncTimers();
    this.notify();
  }

  private resetRoom(): void {
    this.roomUnsub?.();
    this.roomUnsub = null;
    this.room = null;
    this.stopTimers();
  }

  private stopTimers(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.botTimers.forEach(clearTimeout);
    this.botTimers = [];
    this.timerRound = '';
  }

  private syncTimers(): void {
    const room = this.room;
    if (!room || room.status !== 'question') {
      this.stopTimers();
      return;
    }
    this.timeRemainingMs = Math.max(
      0,
      room.config.roundDurationSeconds * 1000 - (Date.now() - room.roundStartedAt),
    );
    const key = `${room.roomId}:${room.currentRoundIndex}:${room.roundStartedAt}`;
    if (key === this.timerRound) return;
    this.stopTimers();
    this.timerRound = key;
    let revealing = false;
    this.tickInterval = setInterval(() => {
      const current = this.room;
      if (!current || current.status !== 'question') return;
      this.timeRemainingMs = Math.max(
        0,
        current.config.roundDurationSeconds * 1000 - (Date.now() - current.roundStartedAt),
      );
      if (
        current.hostUid === this.localPlayerUid &&
        !revealing &&
        (this.timeRemainingMs === 0 || this.allAnswered(current))
      ) {
        revealing = true;
        void this.change((latest) => {
          this.requireHost(latest);
          if (
            latest.status === 'question' &&
            latest.currentRoundIndex === current.currentRoundIndex &&
            latest.roundStartedAt === current.roundStartedAt &&
            (Date.now() >= latest.roundStartedAt + latest.config.roundDurationSeconds * 1000 ||
              this.allAnswered(latest))
          )
            latest.status = 'reveal';
        }).finally(() => {
          revealing = false;
        });
      }
      this.notify();
    }, 250);
    if (room.hostUid !== this.localPlayerUid) return;
    const question = room.questions[room.currentRoundIndex];
    if (!question) return;
    for (const player of Object.values(room.players)) {
      if (!player.isBot || room.roundAnswers[String(room.currentRoundIndex)]?.[player.uid])
        continue;
      const preset = ARENA_BOT_PRESETS.find((b) => b.id === player.uid) || ARENA_BOT_PRESETS[0];
      const delay = preset.minDelayMs + Math.random() * (preset.maxDelayMs - preset.minDelayMs);
      this.botTimers.push(
        setTimeout(() => {
          if (this.timerRound !== key) return;
          const wrong = question.choices.filter((c) => c !== question.answer);
          const choice =
            Math.random() < preset.accuracy
              ? question.answer
              : wrong[Math.floor(Math.random() * wrong.length)];
          void this.answer(player.uid, choice);
        }, delay),
      );
    }
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.notify();
  }
  private notify(): void {
    this.onUpdateCallback?.();
  }
}

export const courseArenaManager = new CourseArenaManager();
