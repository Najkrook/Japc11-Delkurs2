import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyDrills, getDojoExpectedForm } from '../src/course/study-drills.ts';
import { createCourseProgress, type CourseProgressCommand } from '../src/course/course-progress.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import type { CourseProgressData, CourseWeek } from '../src/course/types.ts';

function setup(week: CourseWeek = courseWeeks[0]) {
  const drills = createStudyDrills();
  const saved = new Map<string | null, CourseProgressData>();
  const progress = createCourseProgress(
    {
      readLocal: (uid) => structuredClone(saved.get(uid) ?? createFreshCourseProgress()),
      writeLocal: (uid, data) => {
        saved.set(uid, structuredClone(data));
      },
      readCloud: async () => null,
      writeCloud: async () => {},
    },
    drills.reset,
    () => 100,
  );
  const update = (command: CourseProgressCommand | null) => {
    if (command) progress.update(command);
  };
  return {
    drills,
    progress,
    update,
    vocab: () => drills.vocab.read(week, progress.snapshot()),
    dojo: () => drills.dojo.read(week, courseWeeks, progress.snapshot()),
    quiz: () => drills.quiz.read(week),
  };
}

test('remaining cards shrink from a middle position without skips, then stay safely empty', () => {
  const week = { ...courseWeeks[0], vocab: courseWeeks[0].vocab.slice(0, 4) };
  const { drills, vocab, update, progress } = setup(week);
  drills.vocab.selectFilter('unmastered');
  vocab();
  drills.vocab.move(1);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    seen.push(vocab().current.id);
    drills.vocab.flip();
    update(drills.vocab.markAndAdvance(true));
    assert.equal(vocab().flipped, false);
  }
  assert.deepEqual(seen, [week.vocab[1].id, week.vocab[2].id, week.vocab[3].id, week.vocab[0].id]);
  assert.equal(vocab().items.length, 0);
  assert.equal(vocab().current, undefined);
  assert.equal(vocab().index, 0);
  assert.equal(vocab().remainingCount, 0);
  assert.equal(vocab().masteredCount, 4);
  const before = progress.snapshot();
  assert.equal(drills.vocab.markAndAdvance(true), null);
  drills.vocab.move(-1);
  drills.vocab.flip();
  assert.equal(vocab().index, 0);
  assert.equal(vocab().flipped, false);
  assert.deepEqual(progress.snapshot(), before);
});

test('reviewing an unmastered card advances without removal; list toggles and category filters use current mastery', () => {
  const week = { ...courseWeeks[0], vocab: courseWeeks[0].vocab.slice(0, 3) };
  const { drills, vocab, update, progress } = setup(week);
  drills.vocab.selectFilter('unmastered');
  vocab();
  update(drills.vocab.markAndAdvance(false));
  assert.equal(vocab().current.id, week.vocab[1].id);
  assert.equal(vocab().items.length, 3);
  update(drills.vocab.toggleMastered(week.vocab[1].id));
  update(drills.vocab.toggleMastered(week.vocab[1].id));
  assert.equal(progress.snapshot().masteredVocabIds[week.vocab[1].id], undefined);
  assert.equal(drills.vocab.toggleMastered('missing'), null);
  drills.vocab.selectFilter('not-a-category');
  assert.deepEqual(vocab().items, []);
  assert.equal(drills.vocab.markAndAdvance(false), null);
  drills.vocab.selectFilter(week.vocab[0].category);
  assert.ok(vocab().items.every((item) => item.category === week.vocab[0].category));
});

test('card movement wraps, hides the answer and reconciles a shrinking pool after external progress changes', () => {
  const week = { ...courseWeeks[0], vocab: courseWeeks[0].vocab.slice(0, 3) };
  const { drills, vocab, progress } = setup(week);
  drills.vocab.selectFilter('unmastered');
  vocab();
  drills.vocab.move(-1);
  assert.equal(vocab().current.id, week.vocab[2].id);
  drills.vocab.flip();
  assert.equal(vocab().flipped, true);
  drills.vocab.move(1);
  assert.equal(vocab().current.id, week.vocab[0].id);
  assert.equal(vocab().flipped, false);
  drills.vocab.move(-1);
  progress.update({ type: 'mastery', kind: 'vocab', id: week.vocab[2].id, mastered: true });
  assert.equal(vocab().index, 0);
  assert.equal(vocab().current.id, week.vocab[0].id);
});

test('Dojo grades kana and kanji ignoring whitespace, rejects empty and duplicate answers, and emits mastery commands', () => {
  const { drills, dojo, update, progress } = setup();
  let state = dojo();
  assert.equal(drills.dojo.submit(' \n\t　 '), null);
  assert.equal(dojo().revealed, false);
  const id = state.current.id;
  const answer = [...state.current.teFormKana].join(' ');
  update(drills.dojo.submit(`　${answer}\n`));
  assert.equal(dojo().isCorrect, true);
  assert.equal(progress.snapshot().masteredDojoIds[id], true);
  assert.equal(drills.dojo.submit('incorrect'), null);
  assert.equal(dojo().isCorrect, true);
  drills.dojo.move(1);
  state = dojo();
  assert.equal(state.selectedAnswer, null);
  update(drills.dojo.submit(` ${state.current.teFormKanji} `));
  assert.equal(dojo().isCorrect, true);
  drills.dojo.move(-1);
  update(drills.dojo.submit('wrong'));
  assert.equal(dojo().isCorrect, false);
  assert.equal(progress.snapshot().masteredDojoIds[id], undefined);
});

test('Dojo text input uses the latest value and Enter moves past feedback with cleared answer state', () => {
  const { drills, dojo, update } = setup();
  const first = dojo().current;
  drills.dojo.setInput('typo');
  drills.dojo.setInput(first.teFormKanji);
  update(drills.dojo.submitInput());
  assert.equal(dojo().isCorrect, true);
  drills.dojo.setInput('cannot alter revealed answer');
  assert.equal(dojo().typedAnswer, first.teFormKanji);
  assert.equal(drills.dojo.submitInput(), null);
  assert.notEqual(dojo().current.id, first.id);
  assert.equal(dojo().typedAnswer, '');
  assert.equal(dojo().revealed, false);
  assert.equal(dojo().isCorrect, null);
});

test('Dojo builds four distinct choices for every course verb and filters between current/all weeks', () => {
  const { drills, dojo } = setup();
  assert.equal(dojo().total, courseWeeks[0].conjugations.length);
  drills.dojo.selectFilter('all');
  const total = courseWeeks.reduce((sum, week) => sum + week.conjugations.length, 0);
  assert.equal(dojo().total, total);
  const seen = new Set<string>();
  for (let i = 0; i < total; i++) {
    const state = dojo();
    seen.add(state.current.id);
    assert.equal(state.choices.length, 4);
    assert.equal(new Set(state.choices).size, 4);
    const expected = getDojoExpectedForm(state.current).kana;
    assert.ok(state.choices.includes(expected));
    drills.dojo.move(1);
  }
  assert.equal(seen.size, total);
  assert.equal(dojo().index, 0);
  drills.dojo.selectFilter('current');
  assert.equal(dojo().total, courseWeeks[0].conjugations.length);
  const empty = { ...courseWeeks[0], id: 'empty', conjugations: [] };
  assert.equal(drills.dojo.read(empty, [], createFreshCourseProgress()).current, undefined);
  assert.equal(drills.dojo.submit('て'), null);
  drills.dojo.move(-1);
  assert.equal(drills.dojo.read(empty, [], createFreshCourseProgress()).index, 0);
});

test('quiz requires one valid answer per step, scores the full attempt and finishes exactly once', () => {
  const week = { ...courseWeeks[0], quiz: courseWeeks[0].quiz.slice(0, 3) };
  const { drills, quiz, update, progress } = setup(week);
  assert.equal(quiz().index, 0);
  assert.equal(drills.quiz.advance(), null);
  drills.quiz.choose('not-a-choice');
  assert.equal(quiz().chosen, null);
  for (let i = 0; i < week.quiz.length; i++) {
    const q = quiz().current;
    const choice = i === 1 ? q.choices.find((c) => c !== q.answer)! : q.answer;
    drills.quiz.choose(choice);
    drills.quiz.choose(q.choices.find((c) => c !== choice)!);
    assert.equal(quiz().chosen, choice, 'first answer cannot be overwritten');
    const command = drills.quiz.advance();
    if (i < week.quiz.length - 1) {
      assert.equal(command, null);
      assert.equal(quiz().index, i + 1);
      assert.equal(
        drills.quiz.advance(),
        null,
        'duplicate advance cannot skip an unanswered question',
      );
    } else {
      assert.deepEqual(command, { type: 'quiz', weekId: week.id, score: 2, total: 3 });
      update(command);
    }
  }
  assert.equal(quiz().finished, true);
  assert.equal(quiz().score, 2);
  assert.equal(progress.snapshot().quizBestResults[week.id].score, 2);
  assert.equal(drills.quiz.advance(), null);
  const results = quiz().answers;
  results[week.quiz[0].id] = 'outside mutation';
  assert.equal(quiz().score, 2);
  drills.quiz.reset(week.id);
  assert.equal(quiz().index, 0);
  assert.equal(quiz().finished, false);
  assert.deepEqual(quiz().answers, {});
});

test('quiz changes week safely and empty weeks cannot produce a result', () => {
  const { drills, quiz } = setup();
  const q = quiz().current;
  drills.quiz.choose(q.answer);
  drills.quiz.advance();
  const next = drills.quiz.read(courseWeeks[1]);
  assert.equal(next.index, 0);
  assert.equal(next.score, 0);
  assert.equal(next.chosen, null);
  const empty = { ...courseWeeks[0], id: 'empty', quiz: [] };
  assert.equal(drills.quiz.read(empty).total, 0);
  drills.quiz.choose('anything');
  assert.equal(drills.quiz.advance(), null);
  assert.equal(drills.quiz.read(empty).finished, false);
});

test('Course Progress observes completed drill transitions before synchronous rendering and resets sessions on week/user changes', async () => {
  const week = {
    ...courseWeeks[0],
    vocab: courseWeeks[0].vocab.slice(0, 2),
    quiz: courseWeeks[0].quiz.slice(0, 1),
  };
  const { drills, progress, vocab, dojo, quiz, update } = setup(week);
  drills.vocab.selectFilter('unmastered');
  vocab();
  let duringRender: string | undefined;
  const unsubscribe = progress.subscribe(() => {
    duringRender = vocab().current?.id;
  });
  update(drills.vocab.markAndAdvance(true));
  assert.equal(duringRender, week.vocab[1].id);
  unsubscribe();
  const verb = dojo().current;
  const unwatchDojo = progress.subscribe(() => assert.equal(dojo().revealed, true));
  update(drills.dojo.submit(verb.teFormKana));
  unwatchDojo();
  drills.quiz.choose(quiz().current.answer);
  const unwatchQuiz = progress.subscribe(() => assert.equal(quiz().finished, true));
  update(drills.quiz.advance());
  unwatchQuiz();
  progress.update({ type: 'week', weekId: 'week-2' });
  assert.equal(vocab().flipped, false);
  assert.equal(vocab().filter, 'unmastered');
  assert.equal(dojo().revealed, false);
  assert.equal(quiz().finished, false);
  drills.vocab.flip();
  drills.dojo.setInput('unfinished');
  drills.quiz.choose(quiz().current.answer);
  await progress.useUser('another-student');
  assert.equal(vocab().index, 0);
  assert.equal(vocab().flipped, false);
  assert.equal(dojo().typedAnswer, '');
  assert.equal(dojo().selectedAnswer, null);
  assert.equal(quiz().chosen, null);
});

test('Misstagsbank: weak vocab words track errors, filter smoothly and clear upon mastery', () => {
  const week = { ...courseWeeks[0], vocab: courseWeeks[0].vocab.slice(0, 3) };
  const { drills, progress, vocab, update } = setup(week);

  // Initially no weak words
  assert.equal(vocab().mistakeCount, 0);

  // Student reviews card 0 and needs more practice
  update(drills.vocab.markAndAdvance(false));
  assert.equal(progress.snapshot().mistakeVocabIds?.[week.vocab[0].id], true);
  assert.equal(vocab().mistakeCount, 1);

  // Toggle card 2 manually as weak
  update(drills.vocab.toggleMistake(week.vocab[2].id));
  assert.equal(progress.snapshot().mistakeVocabIds?.[week.vocab[2].id], true);
  assert.equal(vocab().mistakeCount, 2);

  // Switch filter to 'mistakes'
  drills.vocab.selectFilter('mistakes');
  assert.equal(vocab().items.length, 2);
  assert.equal(vocab().current.id, week.vocab[0].id);

  // Master the first weak card
  update(drills.vocab.markAndAdvance(true));
  assert.equal(progress.snapshot().masteredVocabIds[week.vocab[0].id], true);
  assert.equal(progress.snapshot().mistakeVocabIds?.[week.vocab[0].id], undefined);
  assert.equal(vocab().items.length, 1);
  assert.equal(vocab().current.id, week.vocab[2].id);

  // Untoggle card 2
  update(drills.vocab.toggleMistake(week.vocab[2].id));
  assert.equal(progress.snapshot().mistakeVocabIds?.[week.vocab[2].id], undefined);
  assert.equal(vocab().items.length, 0);
  assert.equal(vocab().current, undefined);
});

test('Misstagsbank: Dojo tracks failed verbs, filters to weak pool and clears on correct answer', () => {
  const week = courseWeeks[0];
  const { drills, progress, dojo, update } = setup(week);
  const targetVerb = dojo().current;

  // Submit a wrong answer
  update(drills.dojo.submit('fel-svar'));
  assert.equal(dojo().isCorrect, false);
  assert.equal(progress.snapshot().mistakeDojoIds?.[targetVerb.id], true);

  // Switch filter to 'mistakes'
  drills.dojo.selectFilter('mistakes');
  assert.equal(dojo().total, 1);
  assert.equal(dojo().current.id, targetVerb.id);

  // Submit correct answer
  update(drills.dojo.submit(targetVerb.teFormKana));
  assert.equal(dojo().isCorrect, true);
  assert.equal(progress.snapshot().masteredDojoIds[targetVerb.id], true);
  assert.equal(progress.snapshot().mistakeDojoIds?.[targetVerb.id], undefined);
});
