import type { TemplateResult } from 'lit-html';

export type CourseSubView =
  'hub' | 'vocab' | 'grammar' | 'dojo' | 'kanji' | 'quiz' | 'arena' | 'extra' | 'sushi';

export type VerbGroup = 'u-verb' | 'ru-verb' | 'irregular';

export type TeFormRuleId =
  'u-tsu-ru' | 'mu-bu-nu' | 'ku' | 'gu' | 'su' | 'iku-exception' | 'ru-drop' | 'irregular';

export type VocabCategory = 'verb-u' | 'verb-ru' | 'verb-irr' | 'adjective' | 'noun' | 'expression';

export interface CourseVocabItem {
  id: string;
  weekId: string;
  lesson: number;
  kana: string;
  kanji?: string;
  sv: string;
  en: string;
  category: VocabCategory;
  noteSv?: string;
  exampleJp: string;
  exampleSv: string;
}

export interface VerbConjugationItem {
  id: string;
  weekId: string;
  dictionaryKana: string;
  dictionaryKanji: string;
  politeMasu: string;
  teFormKana: string;
  teFormKanji: string;
  naiFormKana?: string;
  naiFormKanji?: string;
  taFormKana?: string;
  taFormKanji?: string;
  nakattaFormKana?: string;
  nakattaFormKanji?: string;
  group: VerbGroup;
  ruleId: TeFormRuleId;
  ruleLabelSv: string;
  ruleExplanationSv: string;
  sv: string;
  exampleJp: string;
  exampleSv: string;
}

export interface CourseGrammarExample {
  jp: string;
  kana: string;
  sv: string;
}

export interface CourseGrammarPoint {
  id: string;
  weekId: string;
  lesson: number;
  title: string;
  patternJp: string;
  summarySv: string;
  explanationSv: string;
  formationRules: string[];
  examples: CourseGrammarExample[];
  warningSv?: string;
}

export interface CourseKanjiCompound {
  word: string;
  reading: string;
  sv: string;
}

export interface CourseKanjiItem {
  id: string;
  weekId: string;
  lesson: number;
  kanji: string;
  strokes: number;
  onyomi: string[];
  kunyomi: string[];
  meaningSv: string;
  mnemonicSv: string;
  compounds: CourseKanjiCompound[];
}

export interface CourseQuizQuestion {
  id: string;
  weekId: string;
  category: 'vocab' | 'grammar' | 'te-form' | 'kanji';
  prompt: string;
  contextJp?: string;
  choices: string[];
  answer: string;
  acceptedAnswers?: string[];
  explanationSv: string;
  vocabId?: string;
  conjugationId?: string;
  kanjiId?: string;
}

export interface CourseWeek {
  id: string;
  weekNumber: number;
  lessonNumber: number;
  titleSv: string;
  subtitleJp: string;
  badgeText: string;
  themeDescriptionSv: string;
  isPreview?: boolean;
  objectivesSv: string[];
  vocab: CourseVocabItem[];
  grammar: CourseGrammarPoint[];
  conjugations: VerbConjugationItem[];
  kanji: CourseKanjiItem[];
  quiz: CourseQuizQuestion[];
}

export type WeekMedalTier = 'bronze' | 'silver' | 'gold' | null;

export interface WeekQuizResult {
  score: number;
  total: number;
  completedAt: number;
}

export interface CourseProgressData {
  activeWeekId: string;
  activeSubView: CourseSubView;
  masteredVocabIds: Record<string, boolean>;
  masteredKanjiIds: Record<string, boolean>;
  masteredDojoIds: Record<string, boolean>;
  quizBestResults: Record<string, WeekQuizResult>;
  mistakeVocabIds?: Record<string, boolean>;
  mistakeDojoIds?: Record<string, boolean>;
  updatedAt: number;
}

export interface CourseHostContext {
  theme: 'classic' | 'sakura';
  toggleTheme: () => void;
  user: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  authBusy?: boolean;
  authError?: string | null;
  clearAuthError?: () => void;
  speechNotice?: string | null;
  clearSpeechNotice?: () => void;
  onLogin?: () => void;
  account: () => void;
  speak: (text: string, button?: HTMLElement | null) => 'ok' | 'no-voice' | 'unsupported' | void;
  tts: boolean;
  status: string;
  render: () => void;
  announce: (msg: string) => void;
}

export type CourseTemplate = TemplateResult;
