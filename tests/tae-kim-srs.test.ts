import test from 'node:test';
import assert from 'node:assert/strict';
import { taeKimSrs } from '../src/course/tae-kim-srs.ts';
import { CHAPTER_SIZE, TAE_KIM_ARCS, TAE_KIM_CARDS } from '../src/course/data/taeKimData.ts';

test('Tae Kim Data: Has 2 075 cards and 208 chapters across 6 Arcs', () => {
  const chapterCount = Math.ceil(TAE_KIM_CARDS.length / CHAPTER_SIZE);
  assert.equal(TAE_KIM_CARDS.length, 2075);
  assert.equal(chapterCount, 208);
  assert.equal(TAE_KIM_ARCS.length, 6);
  assert.equal(TAE_KIM_ARCS[0].startChapter, 1);
  assert.equal(TAE_KIM_ARCS[5].endChapter, 208);
});

test('Tae Kim SRS: Canonical SM-2 updates intervals, ease factor, and review dates', () => {
  const now = 1700000000000;

  // 1. Initial review: "again" drops to learning (~10m)
  const card1 = taeKimSrs.reviewCard(99901, 'again', now);
  assert.equal(card1.status, 'learning');
  assert.equal(card1.repetitions, 0);
  assert.equal(card1.totalErrors, 1);
  assert.equal(card1.easeFactor, 2.3); // 2.5 - 0.2
  assert.equal(card1.nextReviewDate, now + 10 * 60 * 1000);

  // 2. Initial review: "good" sets interval 1 day
  const card2 = taeKimSrs.reviewCard(99902, 'good', now);
  assert.equal(card2.repetitions, 1);
  assert.equal(card2.interval, 1);
  assert.equal(card2.nextReviewDate, now + 1 * 24 * 60 * 60 * 1000);

  // 3. Second review: "good" sets interval 3 days
  const card2Review2 = taeKimSrs.reviewCard(99902, 'good', now + 1 * 24 * 60 * 60 * 1000);
  assert.equal(card2Review2.repetitions, 2);
  assert.equal(card2Review2.interval, 3);

  // 4. Third review: "good" multiplies by ease factor (3 * 2.5 = ~8 days)
  const card2Review3 = taeKimSrs.reviewCard(99902, 'good', now + 4 * 24 * 60 * 60 * 1000);
  assert.equal(card2Review3.repetitions, 3);
  assert.ok(card2Review3.interval >= 7);

  // 5. "easy" gives bonus interval
  const card3 = taeKimSrs.reviewCard(99903, 'easy', now);
  assert.equal(card3.repetitions, 1);
  assert.equal(card3.interval, 3);
});

test('Tae Kim SRS: Bookmarks track independently without touching course state', () => {
  const saved1 = taeKimSrs.toggleBookmark(42);
  assert.equal(saved1, true);
  assert.equal(taeKimSrs.isBookmarked(42), true);

  const saved2 = taeKimSrs.toggleBookmark(42);
  assert.equal(saved2, false);
  assert.equal(taeKimSrs.isBookmarked(42), false);
});

test('Tae Kim SRS: Arc position can be saved, read and reset', () => {
  assert.equal(taeKimSrs.getArcPosition('arc-test-1'), 0);
  taeKimSrs.setArcPosition('arc-test-1', 42);
  assert.equal(taeKimSrs.getArcPosition('arc-test-1'), 42);
  taeKimSrs.resetArcPosition('arc-test-1');
  assert.equal(taeKimSrs.getArcPosition('arc-test-1'), 0);
});

test('Tae Kim SRS: Arc weak cards track errors and graduate upon good/easy rating', () => {
  const arcId = 'arc-1';
  const cardIndex = 15;

  // Rating 'again' adds card to arc weak cards
  taeKimSrs.reviewCard(cardIndex, 'again', arcId);
  const weakIndices1 = taeKimSrs.getArcWeakCardIndices(arcId);
  assert.ok(weakIndices1.includes(cardIndex));

  // Stats reflect the weak card
  const stats1 = taeKimSrs.getArcStats(TAE_KIM_ARCS[0]);
  assert.ok(stats1.weakCount >= 1);

  // Rating 'good' removes card from arc weak cards (graduates)
  taeKimSrs.reviewCard(cardIndex, 'good', arcId);
  const weakIndices2 = taeKimSrs.getArcWeakCardIndices(arcId);
  assert.ok(!weakIndices2.includes(cardIndex));
});
