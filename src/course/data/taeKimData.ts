import rawCards from './taeKimAnkiData.json' with { type: 'json' };

export interface TaeKimCard {
  kanji: string;
  hiragana: string;
  romaji: string;
  meaning: string;
  source: string;
  audio?: string;
  image?: string;
}

export interface TaeKimChapter {
  index: number; // 0-indexed (0..207)
  chapterNumber: number; // 1-indexed (1..208)
  title: string;
  itemCount: number;
  startIndex: number;
  endIndex: number;
  previewWord: string;
  previewMeaning: string;
}

export interface TaeKimArc {
  id: string;
  arcNumber: number;
  titleSv: string;
  titleJap: string;
  romajiTitle: string;
  descriptionSv: string;
  startChapter: number; // 1-indexed (1..208)
  endChapter: number; // 1-indexed
  startChapterIndex: number; // 0-indexed
  endChapterIndex: number; // 0-indexed
  totalChapters: number;
  totalCards: number;
  iconEmoji: string;
  accentColor: string;
  badgeBg: string;
}

export const TAE_KIM_CARDS: TaeKimCard[] = rawCards as TaeKimCard[];

export const CHAPTER_SIZE = 10;

export const TAE_KIM_ARCS: TaeKimArc[] = [
  {
    id: 'arc-1',
    arcNumber: 1,
    titleSv: 'Arc 1: Hälsningar & Grundord',
    titleJap: '挨拶と基本単語',
    romajiTitle: 'Aisatsu to Kihon Tango',
    descriptionSv:
      'Hälsningsfraser, personliga pronomen, demonstrativer (kore/sore/are), basala substantiv och vanliga anime-utrop.',
    startChapter: 1,
    endChapter: 35,
    startChapterIndex: 0,
    endChapterIndex: 34,
    totalChapters: 35,
    totalCards: 350,
    iconEmoji: '✨',
    accentColor: '#965b1c',
    badgeBg: '#fdf8ee',
  },
  {
    id: 'arc-2',
    arcNumber: 2,
    titleSv: 'Arc 2: Basgrammatik & Partiklar',
    titleJap: '基本文法と助詞',
    romajiTitle: 'Kihon Bunpou to Joshi',
    descriptionSv:
      'Satsstruktur (SOV), existensverb (iru/aru), artighetsnivå (desu/masu) och de fundamentala partiklarna (wa, ga, o, ni, de, to, mo).',
    startChapter: 36,
    endChapter: 70,
    startChapterIndex: 35,
    endChapterIndex: 69,
    totalChapters: 35,
    totalCards: 350,
    iconEmoji: '🧭',
    accentColor: '#1b6e44',
    badgeBg: '#e8f7ef',
  },
  {
    id: 'arc-3',
    arcNumber: 3,
    titleSv: 'Arc 3: Adjektiv & Verbformer',
    titleJap: '形容詞と動詞活用',
    romajiTitle: 'Keiyoushi to Doushi Katsuyou',
    descriptionSv:
      'i-/na-adjektiv, ichidan- och godan-verb, verbens Te-form, pågående handling (-te iru) och att prova på saker (-te miru).',
    startChapter: 71,
    endChapter: 105,
    startChapterIndex: 70,
    endChapterIndex: 104,
    totalChapters: 35,
    totalCards: 350,
    iconEmoji: '⚡',
    accentColor: '#2b5b46',
    badgeBg: '#e7f2ec',
  },
  {
    id: 'arc-4',
    arcNumber: 4,
    titleSv: 'Arc 4: Satsfogning & Modala uttryck',
    titleJap: '複文と助動詞',
    romajiTitle: 'Fukubun to Jodoushi',
    descriptionSv:
      'Bindeord & orsaker (kara, node, noni, kedo), potentialform (dekiru), nödvändighet & tvång (-nakereba naranai) och förslag (-ou).',
    startChapter: 106,
    endChapter: 140,
    startChapterIndex: 105,
    endChapterIndex: 139,
    totalChapters: 35,
    totalCards: 350,
    iconEmoji: '🔥',
    accentColor: '#a64d1f',
    badgeBg: '#fcf3eb',
  },
  {
    id: 'arc-5',
    arcNumber: 5,
    titleSv: 'Arc 5: Givande, Passiv & Nyanser',
    titleJap: '授受動詞と受身・使役',
    romajiTitle: 'Juju Doushi to Ukemi / Shieki',
    descriptionSv:
      'Givande & tagande (ageru, kureru, morau), passiv & kausativ form, råd (-ta hou ga ii) samt överdrifter (-sugiru).',
    startChapter: 141,
    endChapter: 175,
    startChapterIndex: 140,
    endChapterIndex: 174,
    totalChapters: 35,
    totalCards: 350,
    iconEmoji: '🎓',
    accentColor: '#7a3b69',
    badgeBg: '#faeef7',
  },
  {
    id: 'arc-6',
    arcNumber: 6,
    titleSv: 'Arc 6: Fördjupning & Mästarnivå',
    titleJap: 'マスター編: 高度な表現',
    romajiTitle: 'Masutaa-hen: Koudo na Hyougen',
    descriptionSv:
      'Förmodanden (you da, rashii, mitai), simultana handlingar (-nagara), talspråkskontraktioner och autentisk anime-dialog.',
    startChapter: 176,
    endChapter: 208,
    startChapterIndex: 175,
    endChapterIndex: 207,
    totalChapters: 33,
    totalCards: 325,
    iconEmoji: '👑',
    accentColor: '#4a3b8c',
    badgeBg: '#f0eefa',
  },
];

export function extractShortMeaning(meaning: string | undefined): string {
  if (!meaning) return '';

  const colonMatch = meaning.match(/^([\w-]+):\s*(.+?)(?:\s{2,}|$)/);
  if (colonMatch) {
    const def = colonMatch[2].split(/[.!](?:\s|$)/)[0];
    if (def.length <= 80) return def;
  }

  const bracketMatch = meaning.match(/^\[.*?\]\s*(.+?)(?:\.\s|$)/);
  if (bracketMatch) {
    const def = bracketMatch[1];
    if (def.length <= 80) return def;
  }

  const firstSentence = meaning.split(/[.!]\s/)[0];
  if (firstSentence.length <= 80) return firstSentence;
  return `${firstSentence.substring(0, 77)}...`;
}

export function formatAnimeSource(source: string | undefined): string {
  if (!source) return '';
  return source.replace(/_/g, ' ').replace(/\(JP\+Eng\)/gi, '').trim();
}

export function getArcStartIndex(arc: TaeKimArc): number {
  return arc.startChapterIndex * CHAPTER_SIZE;
}

export function getArcEndIndex(arc: TaeKimArc): number {
  return Math.min(TAE_KIM_CARDS.length, (arc.endChapterIndex + 1) * CHAPTER_SIZE);
}

export function getArcCards(arc: TaeKimArc): TaeKimCard[] {
  return TAE_KIM_CARDS.slice(getArcStartIndex(arc), getArcEndIndex(arc));
}

export function getAllChapters(): TaeKimChapter[] {
  const totalChapters = Math.ceil(TAE_KIM_CARDS.length / CHAPTER_SIZE);
  return Array.from({ length: totalChapters }, (_, i) => {
    const startIndex = i * CHAPTER_SIZE;
    const endIndex = Math.min(startIndex + CHAPTER_SIZE, TAE_KIM_CARDS.length);
    const firstCard = TAE_KIM_CARDS[startIndex];
    return {
      index: i,
      chapterNumber: i + 1,
      title: `Kapitel ${i + 1}`,
      itemCount: endIndex - startIndex,
      startIndex,
      endIndex,
      previewWord: firstCard ? (firstCard.kanji || firstCard.hiragana) : '',
      previewMeaning: firstCard ? extractShortMeaning(firstCard.meaning) : '',
    };
  });
}

export const ALL_TAE_KIM_CHAPTERS = getAllChapters();

export function getArcForChapter(chapterIndex: number): TaeKimArc | undefined {
  return TAE_KIM_ARCS.find(
    (arc) => chapterIndex >= arc.startChapterIndex && chapterIndex <= arc.endChapterIndex,
  );
}

export function getArcChapters(arc: TaeKimArc): TaeKimChapter[] {
  return ALL_TAE_KIM_CHAPTERS.slice(arc.startChapterIndex, arc.endChapterIndex + 1);
}

export function getChapterCards(chapterIndex: number): TaeKimCard[] {
  const startIndex = chapterIndex * CHAPTER_SIZE;
  const endIndex = Math.min(startIndex + CHAPTER_SIZE, TAE_KIM_CARDS.length);
  return TAE_KIM_CARDS.slice(startIndex, endIndex);
}

export interface TaeKimSearchResult {
  card: TaeKimCard;
  globalIndex: number;
  chapterIndex: number;
}

export function searchTaeKimCards(query: string, maxResults: number = 40): TaeKimSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: TaeKimSearchResult[] = [];
  for (let i = 0; i < TAE_KIM_CARDS.length; i++) {
    const card = TAE_KIM_CARDS[i];
    if (
      card.romaji.toLowerCase().includes(q) ||
      card.kanji.toLowerCase().includes(q) ||
      card.hiragana.toLowerCase().includes(q) ||
      card.meaning.toLowerCase().includes(q) ||
      card.source.toLowerCase().includes(q)
    ) {
      results.push({
        card,
        globalIndex: i,
        chapterIndex: Math.floor(i / CHAPTER_SIZE),
      });
      if (results.length >= maxResults) break;
    }
  }
  return results;
}
