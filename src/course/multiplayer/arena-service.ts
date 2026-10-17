import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../cloud.ts';
import { calculateArenaPoints, generateArenaQuestionDeck } from './arena-questions.ts';
import type {
  ArenaFocusMode,
  ArenaOpenRoomSummary,
  ArenaPlayer,
  ArenaRoundCount,
  ArenaRoomConfig,
  ArenaRoomDoc,
  ArenaWeekFilter,
} from './arena-types.ts';

const COURSE_ROOMS_COLLECTION = 'courseRooms';
const LOCAL_ROOMS_STORAGE_KEY = 'tentaplugg-course-arena-rooms-v1';

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

function readLocalRoomsMap(): Record<string, ArenaRoomDoc> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ArenaRoomDoc>) : {};
  } catch {
    return {};
  }
}

function writeLocalRoomDoc(room: ArenaRoomDoc): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = readLocalRoomsMap();
    map[room.roomId] = room;
    localStorage.setItem(LOCAL_ROOMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function removeLocalRoomDoc(roomId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = readLocalRoomsMap();
    delete map[roomId];
    localStorage.setItem(LOCAL_ROOMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return String(num);
}

export class CourseArenaManager {
  private room: ArenaRoomDoc | null = null;
  private openRooms: ArenaOpenRoomSummary[] = [];
  private localPlayerUid = 'guest-player';
  private localPlayerName = 'Spelare';
  private isLoggedIn = false;
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
  private roomUnsub: (() => void) | null = null;
  private openRoomsUnsub: (() => void) | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onUpdateCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('tentaplugg-course-arena');
        this.broadcastChannel.onmessage = (ev) => {
          const data = ev.data as { type?: string; room?: ArenaRoomDoc } | undefined;
          if (data?.type === 'room-update' && data.room) {
            if (this.room && this.room.roomId === data.room.roomId) {
              this.room = data.room;
              this.syncTimersForRoom();
              this.notify();
            }
            this.refreshLocalOpenRooms();
          }
        };
      } catch {
        this.broadcastChannel = null;
      }
    }
  }

  public bindHost(
    user: { uid: string; displayName?: string | null; email?: string | null } | null,
    onUpdate: () => void,
  ): void {
    this.onUpdateCallback = onUpdate;
    if (user?.uid) {
      this.localPlayerUid = user.uid;
      this.localPlayerName = user.displayName || user.email?.split('@')[0] || 'Kursdeltagare';
      this.isLoggedIn = true;
    } else {
      this.isLoggedIn = false;
      if (this.localPlayerUid.startsWith('guest-')) {
        if (typeof sessionStorage !== 'undefined') {
          let savedGuestId = sessionStorage.getItem('tentaplugg-arena-guest-uid');
          if (!savedGuestId) {
            savedGuestId = `guest-${Math.floor(1000 + Math.random() * 9000)}`;
            sessionStorage.setItem('tentaplugg-arena-guest-uid', savedGuestId);
          }
          this.localPlayerUid = savedGuestId;
        }
      }
    }
    this.ensureOpenRoomsSubscription();
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
    this.localPlayerName = name.trim() || 'Spelare';
    if (this.room && this.room.players[this.localPlayerUid]) {
      this.room.players[this.localPlayerUid].name = this.localPlayerName;
      void this.persistRoom(this.room);
    }
    this.notify();
  }

  public updateDraftConfig(
    patch: Partial<{
      weekFilter: ArenaWeekFilter;
      focusMode: ArenaFocusMode;
      roundCount: ArenaRoundCount;
    }>,
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

  public async createRoom(withDefaultBot = false): Promise<ArenaRoomDoc> {
    this.errorMessage = '';
    const roomCode = generateRoomCode();
    const roomId = `room-${roomCode}`;
    const now = Date.now();
    const questions = generateArenaQuestionDeck(this.draftConfig);

    const hostPlayer: ArenaPlayer = {
      uid: this.localPlayerUid,
      name: this.localPlayerName,
      avatar: '🦊',
      score: 0,
      streak: 0,
      correctCount: 0,
      joinedAt: now,
    };

    const players: Record<string, ArenaPlayer> = {
      [this.localPlayerUid]: hostPlayer,
    };

    if (withDefaultBot) {
      const preset = ARENA_BOT_PRESETS[0];
      players[preset.id] = {
        uid: preset.id,
        name: preset.name,
        avatar: preset.avatar,
        isBot: true,
        botSkill: preset.skill,
        score: 0,
        streak: 0,
        correctCount: 0,
        joinedAt: now + 1,
      };
    }

    const newRoom: ArenaRoomDoc = {
      roomId,
      roomCode,
      hostUid: this.localPlayerUid,
      hostName: this.localPlayerName,
      status: 'waiting',
      config: { ...this.draftConfig },
      players,
      questions,
      currentRoundIndex: 0,
      roundStartedAt: 0,
      roundAnswers: {},
      createdAt: now,
      updatedAt: now,
    };

    this.room = newRoom;
    await this.persistRoom(newRoom);
    this.subscribeToRoom(roomId);
    this.notify();
    return newRoom;
  }

  public async joinRoomByCode(rawCode?: string): Promise<boolean> {
    const code = (rawCode ?? this.joinCodeInput).trim();
    if (code.length !== 4) {
      this.errorMessage = 'Ange en 4-siffrig rumskod (t.ex. 4821).';
      this.notify();
      return false;
    }
    const roomId = `room-${code}`;
    return this.joinRoomById(roomId);
  }

  public async joinRoomById(roomId: string): Promise<boolean> {
    this.errorMessage = '';
    let found: ArenaRoomDoc | null = null;

    // 1. Check local / BroadcastChannel rooms first
    const localMap = readLocalRoomsMap();
    if (localMap[roomId]) {
      found = localMap[roomId];
    }

    // 2. Check Firestore if logged in
    if (!found && this.isLoggedIn) {
      try {
        const snap = await getDoc(doc(db, COURSE_ROOMS_COLLECTION, roomId));
        if (snap.exists()) {
          found = snap.data() as ArenaRoomDoc;
        }
      } catch {
        // Fallback to local
      }
    }

    if (!found) {
      this.errorMessage = 'Hittade inget aktivt rum med den koden.';
      this.notify();
      return false;
    }

    const now = Date.now();
    if (!found.players[this.localPlayerUid]) {
      found.players[this.localPlayerUid] = {
        uid: this.localPlayerUid,
        name: this.localPlayerName,
        avatar: '🐼',
        score: 0,
        streak: 0,
        correctCount: 0,
        joinedAt: now,
      };
    }

    this.room = found;
    await this.persistRoom(found);
    this.subscribeToRoom(found.roomId);
    this.syncTimersForRoom();
    this.notify();
    return true;
  }

  public async toggleBot(botId: string): Promise<void> {
    if (!this.room || this.room.status !== 'waiting') return;
    const preset = ARENA_BOT_PRESETS.find((b) => b.id === botId);
    if (!preset) return;

    if (this.room.players[botId]) {
      delete this.room.players[botId];
    } else {
      this.room.players[botId] = {
        uid: preset.id,
        name: preset.name,
        avatar: preset.avatar,
        isBot: true,
        botSkill: preset.skill,
        score: 0,
        streak: 0,
        correctCount: 0,
        joinedAt: Date.now(),
      };
    }
    await this.persistRoom(this.room);
    this.notify();
  }

  public async startMatch(): Promise<void> {
    if (!this.room) return;
    const now = Date.now();
    for (const p of Object.values(this.room.players)) {
      p.score = 0;
      p.streak = 0;
      p.correctCount = 0;
    }
    this.room.questions = generateArenaQuestionDeck(this.room.config);
    this.room.currentRoundIndex = 0;
    this.room.roundStartedAt = now;
    this.room.roundAnswers = { '0': {} };
    this.room.status = 'question';
    this.timeRemainingMs = this.room.config.roundDurationSeconds * 1000;

    await this.persistRoom(this.room);
    this.syncTimersForRoom();
    this.notify();
  }

  public async submitAnswer(choice: string): Promise<void> {
    if (!this.room || this.room.status !== 'question') return;
    const roundKey = String(this.room.currentRoundIndex);
    this.room.roundAnswers[roundKey] ||= {};
    if (this.room.roundAnswers[roundKey][this.localPlayerUid]) return;

    const currentQ = this.room.questions[this.room.currentRoundIndex];
    if (!currentQ) return;

    const now = Date.now();
    const durationMs = this.room.config.roundDurationSeconds * 1000;
    const elapsed = Math.max(0, now - this.room.roundStartedAt);
    const remainingMs = Math.max(0, durationMs - elapsed);
    const isCorrect = choice === currentQ.answer;

    const player = this.room.players[this.localPlayerUid];
    const prevStreak = player?.streak || 0;
    const points = calculateArenaPoints(isCorrect, remainingMs, durationMs, prevStreak);

    this.room.roundAnswers[roundKey][this.localPlayerUid] = {
      choice,
      correct: isCorrect,
      pointsAwarded: points,
      timeRemainingMs: remainingMs,
      answeredAt: now,
    };

    if (player) {
      player.score += points;
      player.streak = isCorrect ? prevStreak + 1 : 0;
      if (isCorrect) player.correctCount += 1;
    }

    this.checkIfAllAnswered();
    await this.persistRoom(this.room);
    this.notify();
  }

  public async nextRound(): Promise<void> {
    if (!this.room) return;
    this.clearBotTimers();
    const nextIdx = this.room.currentRoundIndex + 1;
    if (nextIdx >= this.room.questions.length) {
      this.room.status = 'finished';
      this.stopTickLoop();
    } else {
      this.room.currentRoundIndex = nextIdx;
      this.room.roundStartedAt = Date.now();
      this.room.roundAnswers[String(nextIdx)] = {};
      this.room.status = 'question';
      this.timeRemainingMs = this.room.config.roundDurationSeconds * 1000;
    }
    await this.persistRoom(this.room);
    this.syncTimersForRoom();
    this.notify();
  }

  public async leaveRoom(): Promise<void> {
    const prevRoom = this.room;
    this.clearBotTimers();
    this.stopTickLoop();
    if (this.roomUnsub) {
      this.roomUnsub();
      this.roomUnsub = null;
    }
    this.room = null;

    if (prevRoom && prevRoom.hostUid === this.localPlayerUid) {
      removeLocalRoomDoc(prevRoom.roomId);
      if (this.isLoggedIn) {
        try {
          await deleteDoc(doc(db, COURSE_ROOMS_COLLECTION, prevRoom.roomId));
        } catch {
          // Ignore delete errors
        }
      }
    }
    this.refreshLocalOpenRooms();
    this.notify();
  }

  private checkIfAllAnswered(): void {
    if (!this.room || this.room.status !== 'question') return;
    const roundKey = String(this.room.currentRoundIndex);
    const answersForRound = this.room.roundAnswers[roundKey] || {};
    const playerUids = Object.keys(this.room.players);
    if (playerUids.length > 0 && playerUids.every((uid) => Boolean(answersForRound[uid]))) {
      this.room.status = 'reveal';
      this.clearBotTimers();
    }
  }

  private syncTimersForRoom(): void {
    this.clearBotTimers();
    if (!this.room) {
      this.stopTickLoop();
      return;
    }

    if (this.room.status === 'question') {
      const durationMs = this.room.config.roundDurationSeconds * 1000;
      const elapsed = Math.max(0, Date.now() - this.room.roundStartedAt);
      this.timeRemainingMs = Math.max(0, durationMs - elapsed);

      if (!this.tickInterval) {
        this.tickInterval = setInterval(() => {
          if (!this.room || this.room.status !== 'question') return;
          const totalMs = this.room.config.roundDurationSeconds * 1000;
          const passed = Math.max(0, Date.now() - this.room.roundStartedAt);
          this.timeRemainingMs = Math.max(0, totalMs - passed);
          if (this.timeRemainingMs <= 0) {
            this.room.status = 'reveal';
            void this.persistRoom(this.room);
          }
          this.notify();
        }, 250);
      }

      // Schedule bot answers if local user is host
      if (this.room.hostUid === this.localPlayerUid) {
        const roundKey = String(this.room.currentRoundIndex);
        const currentQ = this.room.questions[this.room.currentRoundIndex];
        const answersForRound = this.room.roundAnswers[roundKey] || {};

        for (const player of Object.values(this.room.players)) {
          if (!player.isBot || answersForRound[player.uid] || !currentQ) continue;
          const preset = ARENA_BOT_PRESETS.find((b) => b.id === player.uid) || ARENA_BOT_PRESETS[0];
          const delay =
            preset.minDelayMs + Math.floor(Math.random() * (preset.maxDelayMs - preset.minDelayMs));

          const timer = setTimeout(() => {
            if (!this.room || this.room.status !== 'question') return;
            const rKey = String(this.room.currentRoundIndex);
            this.room.roundAnswers[rKey] ||= {};
            if (this.room.roundAnswers[rKey][player.uid]) return;

            const willBeCorrect = Math.random() < preset.accuracy;
            const wrongChoices = currentQ.choices.filter((c) => c !== currentQ.answer);
            const botChoice = willBeCorrect
              ? currentQ.answer
              : wrongChoices[Math.floor(Math.random() * wrongChoices.length)] ||
                currentQ.choices[0];

            const now = Date.now();
            const durMs = this.room.config.roundDurationSeconds * 1000;
            const remMs = Math.max(0, durMs - Math.max(0, now - this.room.roundStartedAt));
            const botPts = calculateArenaPoints(willBeCorrect, remMs, durMs, player.streak);

            this.room.roundAnswers[rKey][player.uid] = {
              choice: botChoice,
              correct: willBeCorrect,
              pointsAwarded: botPts,
              timeRemainingMs: remMs,
              answeredAt: now,
            };

            player.score += botPts;
            player.streak = willBeCorrect ? player.streak + 1 : 0;
            if (willBeCorrect) player.correctCount += 1;

            this.checkIfAllAnswered();
            void this.persistRoom(this.room);
            this.notify();
          }, delay);

          this.botTimers.push(timer);
        }
      }
    } else {
      this.stopTickLoop();
    }
  }

  private clearBotTimers(): void {
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers = [];
  }

  private stopTickLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private subscribeToRoom(roomId: string): void {
    if (this.roomUnsub) {
      this.roomUnsub();
      this.roomUnsub = null;
    }
    if (!this.isLoggedIn) return;
    try {
      this.roomUnsub = onSnapshot(
        doc(db, COURSE_ROOMS_COLLECTION, roomId),
        (snap) => {
          if (!snap.exists()) return;
          const remote = snap.data() as ArenaRoomDoc;
          if (!this.room || remote.updatedAt >= this.room.updatedAt) {
            this.room = remote;
            writeLocalRoomDoc(remote);
            this.syncTimersForRoom();
            this.notify();
          }
        },
        () => {
          // Ignore snapshot permission errors when offline/guest
        },
      );
    } catch {
      // Ignore
    }
  }

  private ensureOpenRoomsSubscription(): void {
    this.refreshLocalOpenRooms();
    if (this.openRoomsUnsub || !this.isLoggedIn) return;
    try {
      const q = query(
        collection(db, COURSE_ROOMS_COLLECTION),
        where('status', '==', 'waiting'),
        limit(12),
      );
      this.openRoomsUnsub = onSnapshot(
        q,
        (snap) => {
          const remoteSummaries: ArenaOpenRoomSummary[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data() as ArenaRoomDoc;
            remoteSummaries.push({
              roomId: d.roomId,
              roomCode: d.roomCode,
              hostName: d.hostName,
              weekFilter: d.config.weekFilter,
              focusMode: d.config.focusMode,
              roundCount: d.config.roundCount,
              playerCount: Object.keys(d.players || {}).length,
              createdAt: d.createdAt,
            });
          });
          this.mergeOpenRooms(remoteSummaries);
          this.notify();
        },
        () => {
          // Ignore if offline
        },
      );
    } catch {
      // Ignore
    }
  }

  private refreshLocalOpenRooms(): void {
    const map = readLocalRoomsMap();
    const localList: ArenaOpenRoomSummary[] = Object.values(map)
      .filter((r) => r.status === 'waiting')
      .map((d) => ({
        roomId: d.roomId,
        roomCode: d.roomCode,
        hostName: d.hostName,
        weekFilter: d.config.weekFilter,
        focusMode: d.config.focusMode,
        roundCount: d.config.roundCount,
        playerCount: Object.keys(d.players || {}).length,
        createdAt: d.createdAt,
      }));
    this.mergeOpenRooms(localList);
  }

  private mergeOpenRooms(incoming: ArenaOpenRoomSummary[]): void {
    const byId = new Map<string, ArenaOpenRoomSummary>();
    for (const r of incoming) byId.set(r.roomId, r);
    const localMap = readLocalRoomsMap();
    for (const d of Object.values(localMap)) {
      if (d.status === 'waiting') {
        byId.set(d.roomId, {
          roomId: d.roomId,
          roomCode: d.roomCode,
          hostName: d.hostName,
          weekFilter: d.config.weekFilter,
          focusMode: d.config.focusMode,
          roundCount: d.config.roundCount,
          playerCount: Object.keys(d.players || {}).length,
          createdAt: d.createdAt,
        });
      }
    }
    this.openRooms = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  private async persistRoom(room: ArenaRoomDoc): Promise<void> {
    room.updatedAt = Date.now();
    writeLocalRoomDoc(room);
    this.refreshLocalOpenRooms();
    try {
      this.broadcastChannel?.postMessage({ type: 'room-update', room });
    } catch {
      // Ignore
    }
    if (this.isLoggedIn) {
      try {
        await setDoc(doc(db, COURSE_ROOMS_COLLECTION, room.roomId), room);
      } catch {
        // Local fallback already saved
      }
    }
  }

  private notify(): void {
    this.onUpdateCallback?.();
  }
}

export const courseArenaManager = new CourseArenaManager();
