import type { CourseProgressCommand } from './course-progress.ts';
import type {
  CourseKanjiItem,
  CourseProgressData,
  CourseQuizQuestion,
  CourseVocabItem,
  CourseWeek,
  VerbConjugationItem,
} from './types.ts';

const wrap = (index: number, length: number) => (length ? ((index % length) + length) % length : 0);
const normalizeJp = (answer: string) => answer.trim().replace(/\s+/g, '');

export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Shared by solo Dojo and Arena; no rendering or browser dependencies. */
export function buildTeChoices(item: VerbConjugationItem): string[] {
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

export function buildNaiChoices(item: VerbConjugationItem): string[] {
  const target = item.naiFormKana || `${item.dictionaryKana.slice(0, -1)}ない`;
  const stem = item.dictionaryKana.slice(0, -1);
  const candidates = new Set([target]);
  for (const choice of [
    `${stem}わない`,
    `${stem}らない`,
    `${stem}かない`,
    `${stem}さない`,
    `${stem}たない`,
    `${stem}まない`,
    `${stem}ばない`,
    `${stem}ない`,
    `${stem}いない`,
    `${stem}あない`,
    `${stem}しない`,
    `${stem}こない`,
  ]) {
    if (candidates.size >= 4) break;
    if (choice !== target && choice.length >= 2) candidates.add(choice);
  }
  return [...candidates].sort((a, b) => a.localeCompare(b, 'ja'));
}

export function buildTaChoices(item: VerbConjugationItem): string[] {
  const target = item.taFormKana || `${item.dictionaryKana.slice(0, -1)}た`;
  const stem = item.dictionaryKana.slice(0, -1);
  const candidates = new Set([target]);
  for (const choice of [
    `${stem}った`,
    `${stem}んだ`,
    `${stem}いた`,
    `${stem}いだ`,
    `${stem}した`,
    `${stem}た`,
    `${stem}だ`,
    `${item.dictionaryKana}た`,
  ]) {
    if (candidates.size >= 4) break;
    if (choice !== target && choice.length >= 2) candidates.add(choice);
  }
  return [...candidates].sort((a, b) => a.localeCompare(b, 'ja'));
}

export type DojoTargetForm = 'te' | 'nai' | 'ta';

export function getWeekDefaultTargetForm(weekId: string): DojoTargetForm {
  if (['week-3', 'week-5', 'week-7'].includes(weekId)) return 'nai';
  if (['week-4', 'week-6'].includes(weekId)) return 'ta';
  return 'te';
}

export function getDojoExpectedForm(
  item: VerbConjugationItem,
  targetForm?: DojoTargetForm,
): { kana: string; kanji: string } {
  const form = targetForm ?? getWeekDefaultTargetForm(item.weekId);
  if (form === 'nai' && item.naiFormKana) {
    return { kana: item.naiFormKana, kanji: item.naiFormKanji || item.naiFormKana };
  }
  if (form === 'ta' && item.taFormKana) {
    return { kana: item.taFormKana, kanji: item.taFormKanji || item.taFormKana };
  }
  return { kana: item.teFormKana, kanji: item.teFormKanji };
}

export function buildDojoChoices(item: VerbConjugationItem, targetForm?: DojoTargetForm): string[] {
  const form = targetForm ?? getWeekDefaultTargetForm(item.weekId);
  if (form === 'nai') {
    return buildNaiChoices(item);
  }
  if (form === 'ta') {
    return buildTaChoices(item);
  }
  return buildTeChoices(item);
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

function createDojoDrill(rng: () => number = Math.random) {
  let weekId = '';
  let weekFilter: 'current' | 'all' | 'mistakes' = 'current';
  let explicitTargetForm: DojoTargetForm | 'auto' = 'auto';
  let pool: VerbConjugationItem[] = [];
  let index = 0;
  let selectedAnswer: string | null = null;
  let typedAnswer = '';
  let isCorrect: boolean | null = null;
  const choicesCache = new Map<string, string[]>();
  function clearAnswer() {
    selectedAnswer = null;
    typedAnswer = '';
    isCorrect = null;
  }
  function reset() {
    weekId = '';
    pool = [];
    index = 0;
    explicitTargetForm = 'auto';
    choicesCache.clear();
    clearAnswer();
  }
  function move(delta: number) {
    const prev = pool[index];
    if (prev && selectedAnswer !== null) {
      choicesCache.delete(`${prev.id}:${currentTargetForm()}`);
    }
    index = wrap(index + delta, pool.length);
    clearAnswer();
  }
  function currentTargetForm(): DojoTargetForm {
    return explicitTargetForm === 'auto' ? getWeekDefaultTargetForm(weekId) : explicitTargetForm;
  }
  function submit(answer: string): CourseProgressCommand | null {
    const current = pool[index];
    const clean = normalizeJp(answer);
    if (!current || !clean || selectedAnswer !== null) return null;
    selectedAnswer = answer;
    const form = currentTargetForm();
    const expected = getDojoExpectedForm(current, form);
    isCorrect = clean === normalizeJp(expected.kana) || clean === normalizeJp(expected.kanji);
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
      const form = currentTargetForm();
      const expected = current ? getDojoExpectedForm(current, form) : { kana: '', kanji: '' };
      let cardChoices: string[] = [];
      if (current) {
        const cacheKey = `${current.id}:${form}`;
        const existing = choicesCache.get(cacheKey);
        if (existing) {
          cardChoices = existing;
        } else {
          cardChoices = shuffleArray(buildDojoChoices(current, form), rng);
          choicesCache.set(cacheKey, cardChoices);
        }
      }
      return {
        current,
        index,
        total: pool.length,
        weekFilter,
        targetForm: form,
        expected,
        selectedAnswer,
        typedAnswer,
        isCorrect,
        revealed: selectedAnswer !== null,
        choices: cardChoices,
        masteredCount: pool.filter((item) => progress.masteredDojoIds[item.id]).length,
        mistakeCount: mistakeVerbs.length,
      };
    },
    selectFilter(next: 'current' | 'all' | 'mistakes') {
      weekFilter = next;
      index = 0;
      choicesCache.clear();
      clearAnswer();
    },
    selectTargetForm(form: DojoTargetForm | 'auto') {
      explicitTargetForm = form;
      choicesCache.clear();
      clearAnswer();
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

function createQuizDrill(rng: () => number = Math.random) {
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
      if (weekId !== week.id || questions.length !== week.quiz.length) {
        reset(week.id);
      }
      if (questions.length === 0 && week.quiz.length > 0) {
        questions = week.quiz.map((q) => ({
          ...q,
          choices: shuffleArray(q.choices, rng),
        }));
      }
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

function pickDistinctDistractors(
  correct: string,
  pool: readonly string[],
  count = 3,
  rng: () => number = Math.random,
): string[] | null {
  const candidates = Array.from(
    new Set(pool.map((s) => s.trim()).filter((s) => s && s !== correct)),
  );
  if (candidates.length < count) return null;
  const shuffled = shuffleArray(candidates, rng);
  return shuffled.slice(0, count);
}

export function buildKanjiQuizQuestions(
  kanjiList: readonly CourseKanjiItem[],
  rng: () => number = Math.random,
  maxQuestions = 12,
): CourseQuizQuestion[] {
  if (!kanjiList.length) return [];

  const meaningPool = kanjiList.map((k) => k.meaningSv);
  const glyphPool = kanjiList.map((k) => k.kanji);
  const kunPool = kanjiList.flatMap((k) => k.kunyomi.map((r) => r.trim())).filter(Boolean);
  const onPool = kanjiList.flatMap((k) => k.onyomi.map((r) => r.trim())).filter(Boolean);
  const compoundReadingsPool = kanjiList
    .flatMap((k) => k.compounds.map((c) => c.reading.trim()))
    .filter(Boolean);
  const compoundMeaningsPool = kanjiList
    .flatMap((k) => k.compounds.map((c) => c.sv.trim()))
    .filter(Boolean);

  const candidates: CourseQuizQuestion[] = [];
  let counter = 1;

  for (const item of kanjiList) {
    // Type A: Betydelse av Kanji
    const meaningDistractors = pickDistinctDistractors(item.meaningSv, meaningPool, 3, rng);
    if (meaningDistractors) {
      candidates.push({
        id: `kq-m-${item.id}-${counter++}`,
        weekId: item.weekId,
        category: 'kanji',
        kanjiId: item.id,
        contextJp: item.kanji,
        prompt: `Vad betyder kanjit 【${item.kanji}】?`,
        choices: shuffleArray([item.meaningSv, ...meaningDistractors], rng),
        answer: item.meaningSv,
        explanationSv: `【${item.kanji}】 betyder "${item.meaningSv}". ${item.mnemonicSv ? `Minnesregel: ${item.mnemonicSv}` : ''}`,
      });
    }

    // Type B: KUN-läsning
    if (item.kunyomi.length > 0) {
      const primaryKun = item.kunyomi[0].trim();
      const kunDistractors = pickDistinctDistractors(primaryKun, kunPool, 3, rng);
      if (kunDistractors) {
        candidates.push({
          id: `kq-kun-${item.id}-${counter++}`,
          weekId: item.weekId,
          category: 'kanji',
          kanjiId: item.id,
          contextJp: item.kanji,
          prompt: `Vilken är en vanlig KUN-läsning (japansk läsning) för 【${item.kanji}】?`,
          choices: shuffleArray([primaryKun, ...kunDistractors], rng),
          answer: primaryKun,
          explanationSv: `【${item.kanji}】 (${item.meaningSv}) har kun-läsningen "${item.kunyomi.join('・')}" och on-läsningen "${item.onyomi.join('・') || '—'}".`,
        });
      }
    }

    // Type C: ON-läsning
    if (item.onyomi.length > 0) {
      const primaryOn = item.onyomi[0].trim();
      const onDistractors = pickDistinctDistractors(primaryOn, onPool, 3, rng);
      if (onDistractors) {
        candidates.push({
          id: `kq-on-${item.id}-${counter++}`,
          weekId: item.weekId,
          category: 'kanji',
          kanjiId: item.id,
          contextJp: item.kanji,
          prompt: `Vilken är en vanlig ON-läsning (kinesisk läsning) för 【${item.kanji}】?`,
          choices: shuffleArray([primaryOn, ...onDistractors], rng),
          answer: primaryOn,
          explanationSv: `【${item.kanji}】 (${item.meaningSv}) har on-läsningen "${item.onyomi.join('・')}" och kun-läsningen "${item.kunyomi.join('・') || '—'}".`,
        });
      }
    }

    // Type D: Sammansättning (compound)
    if (item.compounds.length > 0) {
      const compound = item.compounds[0];
      const compDistractors = pickDistinctDistractors(
        compound.reading.trim(),
        compoundReadingsPool,
        3,
        rng,
      );
      if (compDistractors) {
        candidates.push({
          id: `kq-comp-${item.id}-${counter++}`,
          weekId: item.weekId,
          category: 'kanji',
          kanjiId: item.id,
          contextJp: compound.word,
          prompt: `Hur uttalas sammansättningen 【${compound.word}】 (${compound.sv})?`,
          choices: shuffleArray([compound.reading.trim(), ...compDistractors], rng),
          answer: compound.reading.trim(),
          explanationSv: `【${compound.word}】 läses "${compound.reading}" och betyder "${compound.sv}".`,
        });
      } else {
        const compMeaningDistractors = pickDistinctDistractors(
          compound.sv.trim(),
          compoundMeaningsPool,
          3,
          rng,
        );
        if (compMeaningDistractors) {
          candidates.push({
            id: `kq-compm-${item.id}-${counter++}`,
            weekId: item.weekId,
            category: 'kanji',
            kanjiId: item.id,
            contextJp: compound.word,
            prompt: `Vad betyder ordet 【${compound.word}】 (${compound.reading})?`,
            choices: shuffleArray([compound.sv.trim(), ...compMeaningDistractors], rng),
            answer: compound.sv.trim(),
            explanationSv: `【${compound.word}】 (${compound.reading}) betyder "${compound.sv}".`,
          });
        }
      }
    }

    // Type E: Identifiera Kanji från betydelse
    const glyphDistractors = pickDistinctDistractors(item.kanji, glyphPool, 3, rng);
    if (glyphDistractors) {
      candidates.push({
        id: `kq-glyph-${item.id}-${counter++}`,
        weekId: item.weekId,
        category: 'kanji',
        kanjiId: item.id,
        contextJp: item.kanji,
        prompt: `Vilket kanji motsvarar betydelsen "${item.meaningSv}"?`,
        choices: shuffleArray([item.kanji, ...glyphDistractors], rng),
        answer: item.kanji,
        explanationSv: `【${item.kanji}】 betyder "${item.meaningSv}".`,
      });
    }
  }

  // Group questions by kanjiId to ensure maximum coverage across the lesson
  const byKanji = new Map<string, CourseQuizQuestion[]>();
  for (const q of shuffleArray(candidates, rng)) {
    const kId = q.kanjiId || 'unknown';
    const list = byKanji.get(kId) || [];
    list.push(q);
    byKanji.set(kId, list);
  }

  const selected: CourseQuizQuestion[] = [];
  const kanjiIds = shuffleArray(Array.from(byKanji.keys()), rng);
  for (const id of kanjiIds) {
    if (selected.length >= maxQuestions) break;
    const questions = byKanji.get(id);
    if (questions && questions.length > 0) {
      selected.push(questions.shift()!);
    }
  }

  if (selected.length < maxQuestions) {
    const remaining = Array.from(byKanji.values()).flat();
    for (const q of shuffleArray(remaining, rng)) {
      if (selected.length >= maxQuestions) break;
      selected.push(q);
    }
  }

  return shuffleArray(selected, rng);
}

function createKanjiQuizDrill(rng: () => number = Math.random) {
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

  function start(week: CourseWeek) {
    reset(week.id);
    questions = buildKanjiQuizQuestions(week.kanji, rng);
  }

  return {
    reset,
    start,
    read(week: CourseWeek) {
      if (weekId !== week.id || questions.length === 0) {
        start(week);
      }
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
    advance(): { finished: boolean; score: number; total: number } | null {
      const current = questions[index];
      if (!current || finished || answers[current.id] === undefined) return null;
      if (index < questions.length - 1) {
        index++;
        return null;
      }
      finished = true;
      return { finished: true, score: score(), total: questions.length };
    },
  };
}

/** In-process Study Drills: transient sessions, returning commands for Course Progress. */
export function createStudyDrills(rng: () => number = Math.random) {
  const vocab = createVocabDrill();
  const dojo = createDojoDrill(rng);
  const quiz = createQuizDrill(rng);
  const kanjiQuiz = createKanjiQuizDrill(rng);
  return {
    vocab,
    dojo,
    quiz,
    kanjiQuiz,
    reset(weekId?: string) {
      vocab.reset();
      dojo.reset();
      quiz.reset(weekId);
      kanjiQuiz.reset(weekId);
    },
  };
}

export const studyDrills = createStudyDrills();
