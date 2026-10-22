export type ArenaWeekFilter =
  'week-1' | 'week-2' | 'week-3' | 'week-4' | 'week-5' | 'week-6' | 'week-7' | 'all';

export type ArenaFocusMode = 'mix' | 'te-form' | 'vocab' | 'kanji' | 'grammar';

export type ArenaRoundCount = 5 | 10 | 15;

export type ArenaRoomPhase = 'lobby' | 'waiting' | 'question' | 'reveal' | 'finished';

export interface ArenaQuestion {
  id: string;
  weekId: string;
  lessonNumber: number;
  category: 'te-form' | 'vocab' | 'kanji' | 'grammar';
  badgeLabel: string;
  prompt: string;
  highlightJp?: string;
  choices: string[];
  answer: string;
  explanationSv: string;
}

export interface ArenaAnswerEntry {
  choice: string;
  correct: boolean;
  pointsAwarded: number;
  timeRemainingMs: number;
  answeredAt: number;
}

export interface ArenaPlayer {
  uid: string;
  name: string;
  avatar: string;
  isBot?: boolean;
  botSkill?: 'chill' | 'steady' | 'sensei';
  score: number;
  streak: number;
  correctCount: number;
  joinedAt: number;
}

export interface ArenaRoomConfig {
  weekFilter: ArenaWeekFilter;
  focusMode: ArenaFocusMode;
  roundCount: ArenaRoundCount;
  roundDurationSeconds: number;
}

export interface ArenaRoomDoc {
  roomId: string;
  roomCode: string;
  hostUid: string;
  hostName: string;
  status: 'waiting' | 'question' | 'reveal' | 'finished';
  config: ArenaRoomConfig;
  players: Record<string, ArenaPlayer>;
  questions: ArenaQuestion[];
  currentRoundIndex: number;
  roundStartedAt: number;
  roundAnswers: Record<string, Record<string, ArenaAnswerEntry>>;
  createdAt: number;
  updatedAt: number;
}

export interface ArenaOpenRoomSummary {
  roomId: string;
  roomCode: string;
  hostName: string;
  weekFilter: ArenaWeekFilter;
  focusMode: ArenaFocusMode;
  roundCount: number;
  playerCount: number;
  createdAt: number;
}
