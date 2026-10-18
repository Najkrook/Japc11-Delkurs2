import { generateArenaQuestionDeck } from './arena-questions.ts';
import type { ArenaRuntime } from './arena-runtime.ts';
import type { ArenaRoomConfig, ArenaRoomDoc } from './arena-types.ts';

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

function calculateArenaPoints(
  isCorrect: boolean,
  timeRemainingMs: number,
  totalDurationMs: number,
  currentStreak: number,
): number {
  if (!isCorrect) return 0;
  const clampedRatio = Math.max(0, Math.min(1, timeRemainingMs / Math.max(1000, totalDurationMs)));
  const basePoints = 500;
  const speedBonus = Math.round(clampedRatio * 500);
  const streakBonus = Math.min(300, currentStreak * 100);
  return basePoints + speedBonus + streakBonus;
}

type MatchTransition = (room: ArenaRoomDoc) => void;
const roundKey = (room: ArenaRoomDoc) =>
  `${room.roomId}:${room.currentRoundIndex}:${room.roundStartedAt}`;
function requireHost(room: ArenaRoomDoc, actor: string): void {
  if (room.hostUid !== actor) throw new Error('host-only');
}
function allAnswered(room: ArenaRoomDoc): boolean {
  const answers = room.roundAnswers[String(room.currentRoundIndex)] || {};
  return Object.keys(room.players).every((uid) => Boolean(answers[uid]));
}

/** Owns match progression. Persistence may retry transitions, so randomness is chosen beforehand. */
export class ArenaMatch {
  private room: ArenaRoomDoc | null = null;
  private timerRound = '';
  private epoch = 0;
  private cancellations: Array<() => void> = [];
  private runtime: ArenaRuntime;
  private change: (transition: MatchTransition) => Promise<void>;
  private notify: () => void;

  constructor(
    runtime: ArenaRuntime,
    change: (transition: MatchTransition) => Promise<void>,
    notify: () => void,
  ) {
    this.runtime = runtime;
    this.change = change;
    this.notify = notify;
  }

  remainingMs(): number {
    const room = this.room;
    return room
      ? Math.max(
          0,
          room.config.roundDurationSeconds * 1000 -
            Math.max(0, this.runtime.now() - room.roundStartedAt),
        )
      : 15000;
  }

  start(config: ArenaRoomConfig, actor: string): MatchTransition {
    const questions = generateArenaQuestionDeck(config, () => this.runtime.random());
    return (room) => {
      requireHost(room, actor);
      if (room.status !== 'waiting' && room.status !== 'finished') return;
      if (!questions.length) return;
      for (const player of Object.values(room.players)) {
        player.score = 0;
        player.streak = 0;
        player.correctCount = 0;
      }
      room.questions = questions;
      room.currentRoundIndex = 0;
      room.roundStartedAt = this.runtime.now();
      room.roundAnswers = { '0': {} };
      room.status = 'question';
    };
  }

  answer(actor: string, uid: string, choice: string): MatchTransition {
    const expected = this.room && roundKey(this.room);
    const epoch = this.epoch;
    return (room) => {
      if (this.epoch !== epoch || room.status !== 'question' || roundKey(room) !== expected) return;
      if (uid !== actor && (room.hostUid !== actor || !room.players[uid]?.isBot)) return;
      const key = String(room.currentRoundIndex);
      const question = room.questions[room.currentRoundIndex];
      const player = room.players[uid];
      if (
        !player ||
        !question ||
        !question.choices.includes(choice) ||
        room.roundAnswers[key]?.[uid]
      )
        return;
      const now = this.runtime.now();
      const duration = room.config.roundDurationSeconds * 1000;
      const remaining = duration - Math.max(0, now - room.roundStartedAt);
      if (remaining <= 0) return;
      const correct = choice === question.answer;
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
      if (room.hostUid === actor && allAnswered(room)) room.status = 'reveal';
    };
  }

  next(actor: string): MatchTransition {
    const expected = this.room && roundKey(this.room);
    return (room) => {
      requireHost(room, actor);
      if (room.status !== 'reveal' || roundKey(room) !== expected) return;
      if (room.currentRoundIndex + 1 >= room.questions.length) room.status = 'finished';
      else {
        room.currentRoundIndex++;
        room.roundStartedAt = this.runtime.now();
        room.roundAnswers[String(room.currentRoundIndex)] = {};
        room.status = 'question';
      }
    };
  }

  reset(): void {
    this.room = null;
    this.stopTimers();
  }

  private stopTimers(): void {
    this.epoch++;
    this.cancellations.forEach((cancel) => cancel());
    this.cancellations = [];
    this.timerRound = '';
  }

  observe(room: ArenaRoomDoc, actor: string): void {
    this.room = room;
    if (room.status !== 'question') {
      this.stopTimers();
      return;
    }
    const key = roundKey(room);
    if (key === this.timerRound) return;
    this.stopTimers();
    this.timerRound = key;
    const epoch = this.epoch;
    let revealing = false;
    this.cancellations.push(
      this.runtime.every(250, () => {
        // A callback may already be queued when its timer is cancelled.
        if (epoch !== this.epoch) return;
        const current = this.room;
        if (!current || current.status !== 'question' || roundKey(current) !== key) return;
        if (
          current.hostUid === actor &&
          !revealing &&
          (this.remainingMs() === 0 || allAnswered(current))
        ) {
          revealing = true;
          void this.change((latest) => {
            if (epoch !== this.epoch) return;
            requireHost(latest, actor);
            if (
              latest.status === 'question' &&
              roundKey(latest) === key &&
              (this.runtime.now() >=
                latest.roundStartedAt + latest.config.roundDurationSeconds * 1000 ||
                allAnswered(latest))
            ) {
              latest.status = 'reveal';
            }
          }).finally(() => {
            revealing = false;
          });
        }
        this.notify();
      }),
    );
    if (room.hostUid !== actor) return;
    const question = room.questions[room.currentRoundIndex];
    if (!question) return;
    for (const player of Object.values(room.players)) {
      if (!player.isBot || room.roundAnswers[String(room.currentRoundIndex)]?.[player.uid])
        continue;
      const preset = ARENA_BOT_PRESETS.find((bot) => bot.id === player.uid) || ARENA_BOT_PRESETS[0];
      const delay =
        preset.minDelayMs + this.runtime.random() * (preset.maxDelayMs - preset.minDelayMs);
      this.cancellations.push(
        this.runtime.after(delay, () => {
          if (epoch !== this.epoch) return;
          const wrong = question.choices.filter((choice) => choice !== question.answer);
          const choice =
            this.runtime.random() < preset.accuracy
              ? question.answer
              : wrong[Math.floor(this.runtime.random() * wrong.length)];
          // Capture the choice once, before the store can retry the transition.
          void this.change(this.answer(actor, player.uid, choice));
        }),
      );
    }
  }
}
