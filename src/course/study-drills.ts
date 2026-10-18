import type { CourseProgressCommand } from './course-progress.ts';
import type {
  CourseProgressData,
  CourseQuizQuestion,
  CourseVocabItem,
  CourseWeek,
  VerbConjugationItem,
} from './types.ts';

const wrap = (index: number, length: number) => (length ? ((index % length) + length) % length : 0);
const normalizeJp = (answer: string) => answer.trim().replace(/\s+/g, '');

/** Shared by solo Dojo and Arena; no rendering or browser dependencies. */
export function buildDojoChoices(item: VerbConjugationItem): string[] {
  const stem = item.dictionaryKana.slice(0, -1);
  const candidates = new Set([item.teFormKana]);
  for (const choice of [
    `${stem}って`,
    `${stem}んで`,
    `${stem}いて`,
    `${stem}いで`,
    `${stem}して`,
    `${stem}て`,
    `${item.dictionaryKana}て`,
  ]) {
    if (candidates.size >= 4) break;
    if (choice !== item.teFormKana && choice.length >= 2) candidates.add(choice);
  }
  return [...candidates].sort((a, b) => a.localeCompare(b, 'ja'));
}

function createVocabDrill() {
  let weekId = '';
  let all: CourseVocabItem[] = [];
  let mastery: Record<string, boolean> = {};
  let mistakes: Record<string, boolean> = {};
  let filter = 'all';
  let index = 0;
  let flipped = false;

  const items = () =>
    all.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'unmastered') return !mastery[item.id];
      if (filter === 'mistakes') return Boolean(mistakes[item.id]);
      return item.category === filter;
    });

  function reset() {
    weekId = '';
    all = [];
    mastery = {};
    mistakes = {};
    index = 0;
    flipped = false;
  }

  function mark(id: string, mastered: boolean, mistake?: boolean): CourseProgressCommand {
    mastery[id] = mastered;
    if (mastered) {
      delete mistakes[id];
    } else if (mistake) {
      mistakes[id] = true;
    }
    return { type: 'mastery', kind: 'vocab', id, mastered, mistake };
  }

  return {
    reset,
    read(week: CourseWeek, progress: CourseProgressData) {
      if (weekId !== week.id) reset();
      weekId = week.id;
      all = week.vocab;
      mastery = { ...progress.masteredVocabIds };
      mistakes = { ...(progress.mistakeVocabIds || {}) };
      const filtered = items();
      index = wrap(index, filtered.length);
      return {
        items: filtered,
        current: filtered[index],
        index,
        filter,
        flipped,
        masteredCount: all.filter((item) => mastery[item.id]).length,
        remainingCount: all.filter((item) => !mastery[item.id]).length,
        mistakeCount: all.filter((item) => mistakes[item.id]).length,
        mistakes: { ...mistakes },
      };
    },
    selectFilter(next: string) {
      filter = next;
      index = 0;
      flipped = false;
    },
    flip() {
      if (items().length) flipped = !flipped;
    },
    move(delta: number) {
      index = wrap(index + delta, items().length);
      flipped = false;
    },
    markAndAdvance(mastered: boolean): CourseProgressCommand | null {
      const before = items();
      const position = wrap(index, before.length);
      const current = before[position];
      if (!current) return null;
      const command = mark(current.id, mastered, !mastered);
      // Removing the current card shifts the next card into its position.
      const shouldShift =
        (filter === 'unmastered' && mastered) || (filter === 'mistakes' && mastered);
      index = wrap(position + (shouldShift ? 0 : 1), items().length);
      flipped = false;
      return command;
    },
    toggleMastered(id: string): CourseProgressCommand | null {
      if (!all.some((item) => item.id === id)) return null;
      return mark(id, !mastery[id]);
    },
    toggleMistake(id: string): CourseProgressCommand | null {
      if (!all.some((item) => item.id === id)) return null;
      const next = !mistakes[id];
      if (next) mistakes[id] = true;
      else delete mistakes[id];
      return { type: 'mistake', kind: 'vocab', id, mistake: next };
    },
  };
}

function createDojoDrill() {
  let weekId = '';
  let weekFilter: 'current' | 'all' | 'mistakes' = 'current';
  let pool: VerbConjugationItem[] = [];
  let index = 0;
  let selectedAnswer: string | null = null;
  let typedAnswer = '';
  let isCorrect: boolean | null = null;
  function clearAnswer() {
    selectedAnswer = null;
    typedAnswer = '';
    isCorrect = null;
  }
  function reset() {
    weekId = '';
    pool = [];
    index = 0;
    clearAnswer();
  }
  function move(delta: number) {
    index = wrap(index + delta, pool.length);
    clearAnswer();
  }
  function submit(answer: string): CourseProgressCommand | null {
    const current = pool[index];
    const clean = normalizeJp(answer);
    if (!current || !clean || selectedAnswer !== null) return null;
    selectedAnswer = answer;
    isCorrect =
      clean === normalizeJp(current.teFormKana) || clean === normalizeJp(current.teFormKanji);
    return {
      type: 'mastery',
      kind: 'dojo',
      id: current.id,
      mastered: isCorrect,
      mistake: !isCorrect,
    };
  }
  return {
    reset,
    read(week: CourseWeek, weeks: CourseWeek[], progress: CourseProgressData) {
      if (weekId !== week.id) reset();
      weekId = week.id;
      const allVerbs = weeks.flatMap((w) => w.conjugations);
      const mistakeVerbs = allVerbs.filter((c) => progress.mistakeDojoIds?.[c.id]);
      pool =
        weekFilter === 'all'
          ? allVerbs
          : weekFilter === 'mistakes'
            ? mistakeVerbs
            : week.conjugations;
      index = wrap(index, pool.length);
      const current = pool[index];
      return {
        current,
        index,
        total: pool.length,
        weekFilter,
        selectedAnswer,
        typedAnswer,
        isCorrect,
        revealed: selectedAnswer !== null,
        choices: current ? buildDojoChoices(current) : [],
        masteredCount: pool.filter((item) => progress.masteredDojoIds[item.id]).length,
        mistakeCount: mistakeVerbs.length,
      };
    },
    selectFilter(next: 'current' | 'all' | 'mistakes') {
      weekFilter = next;
      reset();
    },
    setInput(value: string) {
      if (selectedAnswer === null) typedAnswer = value;
    },
    move,
    submit,
    submitInput(): CourseProgressCommand | null {
      if (selectedAnswer !== null) {
        move(1);
        return null;
      }
      return submit(typedAnswer);
    },
  };
}

function createQuizDrill() {
  let weekId = '';
  let questions: CourseQuizQuestion[] = [];
  let index = 0;
  let answers: Record<string, string> = {};
  let finished = false;
  const score = () => questions.filter((q) => answers[q.id] === q.answer).length;
  function reset(nextWeekId = '') {
    weekId = nextWeekId;
    questions = [];
    index = 0;
    answers = {};
    finished = false;
  }
  return {
    reset,
    read(week: CourseWeek) {
      if (weekId !== week.id) reset(week.id);
      questions = week.quiz;
      index = Math.min(index, Math.max(0, questions.length - 1));
      const current = questions[index];
      return {
        questions,
        current,
        index,
        total: questions.length,
        score: score(),
        finished,
        answers: { ...answers },
        chosen: current ? (answers[current.id] ?? null) : null,
      };
    },
    choose(choice: string): void {
      const current = questions[index];
      if (
        !current ||
        finished ||
        answers[current.id] !== undefined ||
        !current.choices.includes(choice)
      )
        return;
      answers[current.id] = choice;
    },
    advance(): CourseProgressCommand | null {
      const current = questions[index];
      if (!current || finished || answers[current.id] === undefined) return null;
      if (index < questions.length - 1) {
        index++;
        return null;
      }
      finished = true;
      return { type: 'quiz', weekId, score: score(), total: questions.length };
    },
  };
}

/** In-process Study Drills: transient sessions, returning commands for Course Progress. */
export function createStudyDrills() {
  const vocab = createVocabDrill();
  const dojo = createDojoDrill();
  const quiz = createQuizDrill();
  return {
    vocab,
    dojo,
    quiz,
    reset(weekId?: string) {
      vocab.reset();
      dojo.reset();
      quiz.reset(weekId);
    },
  };
}

export const studyDrills = createStudyDrills();
