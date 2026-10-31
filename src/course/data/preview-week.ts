import type {
  CourseWeek,
  CourseVocabItem,
  CourseKanjiItem,
  CourseGrammarPoint,
  CourseQuizQuestion,
  VerbConjugationItem,
} from '../types.ts';

// Compact authoring format for the new preview weeks; runtime data uses CourseWeek as before.
export type VocabRow = [
  kana: string,
  kanji: string,
  sv: string,
  en: string,
  category: CourseVocabItem['category'],
  exampleJp: string,
  exampleSv: string,
];
export type KanjiRow = [
  kanji: string,
  strokes: number,
  on: string[],
  kun: string[],
  meaning: string,
  mnemonic: string,
  compounds: [string, string, string][],
];
export type GrammarEntry = Omit<CourseGrammarPoint, 'id' | 'weekId' | 'lesson'>;
export type QuizEntry = Omit<CourseQuizQuestion, 'id' | 'weekId'>;

function conjugation(v: CourseVocabItem, id: string): VerbConjugationItem {
  const group =
    v.category === 'verb-ru' ? 'ru-verb' : v.category === 'verb-irr' ? 'irregular' : 'u-verb';
  const ending = v.kana.slice(-1);
  const endings: Record<string, [string, string, string, VerbConjugationItem['ruleId']]> = {
    う: ['い', 'わ', 'って', 'u-tsu-ru'],
    つ: ['ち', 'た', 'って', 'u-tsu-ru'],
    る: ['り', 'ら', 'って', 'u-tsu-ru'],
    む: ['み', 'ま', 'んで', 'mu-bu-nu'],
    ぶ: ['び', 'ば', 'んで', 'mu-bu-nu'],
    ぬ: ['に', 'な', 'んで', 'mu-bu-nu'],
    く: ['き', 'か', 'いて', 'ku'],
    ぐ: ['ぎ', 'が', 'いで', 'gu'],
    す: ['し', 'さ', 'して', 'su'],
  };
  const isIku = v.kana === 'いく';
  const ruleId =
    group === 'ru-verb'
      ? 'ru-drop'
      : group === 'irregular'
        ? 'irregular'
        : isIku
          ? 'iku-exception'
          : endings[ending][3];
  const forms = (word: string) => {
    if (group === 'irregular') {
      // These weeks use する compounds. Keep the irregular stem explicit.
      if (!word.endsWith('する')) throw new Error(`Unsupported irregular verb: ${word}`);
      const stem = word.slice(0, -2);
      return [stem + 'します', stem + 'して', stem + 'しない', stem + 'した', stem + 'しなかった'];
    }
    const stem = word.slice(0, -1);
    const [masu, nai, te] = group === 'ru-verb' ? ['', '', 'て'] : endings[ending];
    const teForm = stem + (isIku ? 'って' : te);
    const naiForm = stem + nai + 'ない';
    return [
      stem + masu + 'ます',
      teForm,
      naiForm,
      teForm.slice(0, -1) + (teForm.endsWith('で') ? 'だ' : 'た'),
      naiForm.slice(0, -2) + 'なかった',
    ];
  };
  const kana = forms(v.kana);
  const kanji = forms(v.kanji || v.kana);
  return {
    id,
    weekId: v.weekId,
    dictionaryKana: v.kana,
    dictionaryKanji: v.kanji || v.kana,
    politeMasu: kanji[0],
    teFormKana: kana[1],
    teFormKanji: kanji[1],
    naiFormKana: kana[2],
    naiFormKanji: kanji[2],
    taFormKana: kana[3],
    taFormKanji: kanji[3],
    nakattaFormKana: kana[4],
    nakattaFormKanji: kanji[4],
    group,
    ruleId,
    ruleLabelSv: `${v.kana} → ${kana[1]} / ${kana[2]} / ${kana[3]}`,
    ruleExplanationSv:
      group === 'ru-verb'
        ? 'Ru-verb: ta bort る och lägg till て, ない eller た. Nekande dåtid slutar på なかった.'
        : group === 'irregular'
          ? 'する böjs till して, しない och した. Samma böjning används efter substantiv i する-verb.'
          : isIku
            ? '行く är undantaget: いって och いった. Nekande kortform är いかない.'
            : `U-verb: ${ending} blir ${endings[ending][2]} i て-form och ${endings[ending][1]}ない i nekande kortform. Byt sista て/で mot た/だ för dåtid.`,
    sv: v.sv,
    exampleJp: v.exampleJp,
    exampleSv: v.exampleSv,
  };
}

export function previewWeek(
  weekNumber: number,
  title: string,
  subtitle: string,
  themeDescriptionSv: string,
  objectivesSv: string[],
  rows: VocabRow[],
  grammarEntries: GrammarEntry[],
  kanjiRows: KanjiRow[],
  questions: QuizEntry[],
): CourseWeek {
  const weekId = `week-${weekNumber}`;
  const lesson = weekNumber + 5;
  const id = (kind: string, index: number) =>
    `w${weekNumber}-${kind}${String(index + 1).padStart(2, '0')}`;
  const vocab = rows.map(
    ([kana, kanji, sv, en, category, exampleJp, exampleSv], i): CourseVocabItem => ({
      id: id('v', i),
      weekId,
      lesson,
      kana,
      kanji: kanji || undefined,
      sv,
      en,
      category,
      exampleJp,
      exampleSv,
    }),
  );
  const conjugations = vocab
    .filter((v) => v.category.startsWith('verb-'))
    .map((v, i) => conjugation(v, id('c', i)));
  const kanji = kanjiRows.map(
    ([kanji, strokes, onyomi, kunyomi, meaningSv, mnemonicSv, compounds], i): CourseKanjiItem => ({
      id: id('k', i),
      weekId,
      lesson,
      kanji,
      strokes,
      onyomi,
      kunyomi,
      meaningSv,
      mnemonicSv,
      compounds: compounds.map(([word, reading, sv]) => ({ word, reading, sv })),
    }),
  );
  // Supplement the authored grammar questions with vocabulary and kanji recall.
  const recall: QuizEntry[] = vocab.slice(0, 3).map((v, i) => ({
    category: 'vocab',
    prompt: `Vad betyder ${v.kanji || v.kana} (${v.kana})?`,
    choices: [v.sv, ...vocab.slice(i + 3, i + 6).map((x) => x.sv)],
    answer: v.sv,
    explanationSv: `${v.kana} betyder ${v.sv}. ${v.exampleSv}`,
    vocabId: v.id,
  }));
  recall.push(
    ...kanji.slice(0, 3).map((k, i): QuizEntry => ({
      category: 'kanji',
      prompt: `Hur läser du ${k.compounds[0].word}?`,
      choices: [
        k.compounds[0].reading,
        ...kanji.slice(i + 3, i + 6).map((x) => x.compounds[0].reading),
      ],
      answer: k.compounds[0].reading,
      explanationSv: `${k.compounds[0].word} (${k.compounds[0].reading}) betyder ${k.compounds[0].sv}.`,
      kanjiId: k.id,
    })),
  );
  return {
    id: weekId,
    weekNumber,
    lessonNumber: lesson,
    titleSv: `Kapitel ${lesson}: ${title}`,
    subtitleJp: `第${lesson}課 · ${subtitle}`,
    badgeText: `GENKI I · KAPITEL ${lesson}`,
    themeDescriptionSv,
    isPreview: true,
    objectivesSv,
    vocab,
    conjugations,
    kanji,
    grammar: grammarEntries.map((g, i) => ({ ...g, id: id('g', i), weekId, lesson })),
    quiz: [...questions, ...recall].map((q, i) => ({ ...q, id: id('q', i), weekId })),
  };
}
