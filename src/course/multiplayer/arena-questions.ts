import { courseWeeks } from '../data/index.ts';
import { buildDojoChoices } from '../study-drills.ts';
import type { ArenaQuestion, ArenaRoomConfig, ArenaWeekFilter } from './arena-types.ts';
import type { CourseWeek } from '../types.ts';

function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistractors(
  correct: string,
  pool: string[],
  count = 3,
  rng: () => number = Math.random,
): string[] {
  const unique = Array.from(new Set(pool.filter((item) => item && item !== correct)));
  return shuffleArray(unique, rng).slice(0, count);
}

export function buildAllCourseArenaQuestions(
  weekFilter: ArenaWeekFilter = 'all',
  rng: () => number = Math.random,
): ArenaQuestion[] {
  const targetWeeks: CourseWeek[] =
    weekFilter === 'all' ? courseWeeks : courseWeeks.filter((w) => w.id === weekFilter);

  const weeks = targetWeeks.length > 0 ? targetWeeks : courseWeeks;
  const allVocabSv = courseWeeks.flatMap((w) => w.vocab.map((v) => v.sv));
  const allVocabJp = courseWeeks.flatMap((w) =>
    w.vocab.map((v) => (v.kanji ? `${v.kanji} (${v.kana})` : v.kana)),
  );
  const allKanjiMeanings = courseWeeks.flatMap((w) => w.kanji.map((k) => k.meaningSv));
  const allCompoundReadings = courseWeeks.flatMap((w) =>
    w.kanji.flatMap((k) => k.compounds.map((c) => c.reading)),
  );

  const bank: ArenaQuestion[] = [];

  for (const week of weeks) {
    // 1. Direct quiz questions from the week
    for (const q of week.quiz) {
      bank.push({
        id: `aq-quiz-${q.id}`,
        weekId: week.id,
        lessonNumber: week.lessonNumber,
        category: q.category,
        badgeLabel: `Lektion ${week.lessonNumber} · ${
          q.category === 'te-form'
            ? 'て-form'
            : q.category === 'vocab'
              ? 'Glosor'
              : q.category === 'kanji'
                ? 'Kanji'
                : 'Grammatik'
        }`,
        prompt: q.prompt,
        choices: shuffleArray(q.choices, rng),
        answer: q.answer,
        explanationSv: q.explanationSv,
      });
    }

    // 2. Generated Te-Form conjugation questions
    for (const conj of week.conjugations) {
      const choices = shuffleArray(buildDojoChoices(conj), rng);
      bank.push({
        id: `aq-te-${conj.id}`,
        weekId: week.id,
        lessonNumber: week.lessonNumber,
        category: 'te-form',
        badgeLabel: `Lektion ${week.lessonNumber} · て-form Dojo`,
        prompt: `Vilken är rätt て-form av ${conj.dictionaryKanji} (${conj.dictionaryKana} — "${conj.sv}")?`,
        highlightJp: `${conj.dictionaryKanji}（${conj.dictionaryKana}）`,
        choices,
        answer: conj.teFormKana,
        explanationSv: `${conj.ruleLabelSv}: ${conj.dictionaryKanji} (${conj.dictionaryKana}) → ${conj.teFormKanji} (${conj.teFormKana}). ${conj.ruleExplanationSv}`,
      });
    }

    // 3. Generated Vocabulary questions (JP -> SV and SV -> JP)
    for (const v of week.vocab) {
      const jpDisplay = v.kanji ? `${v.kanji}（${v.kana}）` : v.kana;
      const svDistractors = pickDistractors(
        v.sv,
        week.vocab.map((x) => x.sv).concat(allVocabSv),
        3,
        rng,
      );
      if (svDistractors.length === 3) {
        bank.push({
          id: `aq-voc-sv-${v.id}`,
          weekId: week.id,
          lessonNumber: week.lessonNumber,
          category: 'vocab',
          badgeLabel: `Lektion ${week.lessonNumber} · Glosor (JP ➔ SV)`,
          prompt: `Vad betyder "${jpDisplay}" på svenska?`,
          highlightJp: jpDisplay,
          choices: shuffleArray([v.sv, ...svDistractors], rng),
          answer: v.sv,
          explanationSv: `${jpDisplay} betyder "${v.sv}". Exempel: ${v.exampleJp} (${v.exampleSv})`,
        });
      }

      const jpAnswer = v.kanji ? `${v.kanji} (${v.kana})` : v.kana;
      const jpDistractors = pickDistractors(
        jpAnswer,
        week.vocab.map((x) => (x.kanji ? `${x.kanji} (${x.kana})` : x.kana)).concat(allVocabJp),
        3,
        rng,
      );
      if (jpDistractors.length === 3) {
        bank.push({
          id: `aq-voc-jp-${v.id}`,
          weekId: week.id,
          lessonNumber: week.lessonNumber,
          category: 'vocab',
          badgeLabel: `Lektion ${week.lessonNumber} · Glosor (SV ➔ JP)`,
          prompt: `Hur säger man "${v.sv}" på japanska?`,
          choices: shuffleArray([jpAnswer, ...jpDistractors], rng),
          answer: jpAnswer,
          explanationSv: `"${v.sv}" heter ${jpAnswer} på japanska.`,
        });
      }
    }

    // 4. Generated Kanji & Compound reading questions
    for (const k of week.kanji) {
      const meaningDistractors = pickDistractors(
        k.meaningSv,
        week.kanji.map((x) => x.meaningSv).concat(allKanjiMeanings),
        3,
        rng,
      );
      if (meaningDistractors.length === 3) {
        bank.push({
          id: `aq-kanji-m-${k.id}`,
          weekId: week.id,
          lessonNumber: week.lessonNumber,
          category: 'kanji',
          badgeLabel: `Lektion ${week.lessonNumber} · Kanji`,
          prompt: `Vad betyder kanjitecknet ${k.kanji}?`,
          highlightJp: k.kanji,
          choices: shuffleArray([k.meaningSv, ...meaningDistractors], rng),
          answer: k.meaningSv,
          explanationSv: `${k.kanji} (${k.strokes} streck) betyder "${k.meaningSv}". Minnesregel: ${k.mnemonicSv}`,
        });
      }

      for (const comp of k.compounds.slice(0, 2)) {
        const readingDistractors = pickDistractors(comp.reading, allCompoundReadings, 3, rng);
        if (readingDistractors.length === 3) {
          bank.push({
            id: `aq-kanji-c-${k.id}-${comp.word}`,
            weekId: week.id,
            lessonNumber: week.lessonNumber,
            category: 'kanji',
            badgeLabel: `Lektion ${week.lessonNumber} · Kanjiläsning`,
            prompt: `Hur läses ${comp.word} ("${comp.sv}") med hiragana?`,
            highlightJp: comp.word,
            choices: shuffleArray([comp.reading, ...readingDistractors], rng),
            answer: comp.reading,
            explanationSv: `${comp.word} läses ${comp.reading} och betyder "${comp.sv}".`,
          });
        }
      }
    }
  }

  return bank;
}

export function generateArenaQuestionDeck(
  config: Pick<ArenaRoomConfig, 'weekFilter' | 'focusMode' | 'roundCount'>,
  rng: () => number = Math.random,
): ArenaQuestion[] {
  const all = buildAllCourseArenaQuestions(config.weekFilter, rng);
  const filtered =
    config.focusMode === 'mix' ? all : all.filter((q) => q.category === config.focusMode);

  return shuffleArray(filtered, rng).slice(0, config.roundCount);
}
