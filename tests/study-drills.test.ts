import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKanjiQuizQuestions,
  createStudyDrills,
  getDojoExpectedForm,
} from '../src/course/study-drills.ts';
import { recordQuizMistakes } from '../src/course/components/week-quiz.ts';
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
    kanjiQuiz: () => drills.kanjiQuiz.read(week),
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
    const expected = getDojoExpectedForm(state.current, state.targetForm).kana;
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

test('Misstagsbank: Weekly quiz connects mistakes explicitly to vocabId and conjugationId without false substring matches', () => {
  const week = courseWeeks[0];
  const { progress, update } = setup(week);

  // w1-q07 wrong: particle question with "次の駅" which previously false-matched "つぎ"
  // w1-q09 wrong: 消す -> vocabId 'w1-v04'
  // w1-q01 wrong: 行く -> conjugationId 'w1-c09'
  // w1-q06 wrong: 開ける -> vocabId 'w1-v14' & conjugationId 'w1-c12'
  // w1-q02 correct: 遊ぶ -> conjugationId 'w1-c06'
  const answers: Record<string, string> = {
    'w1-q07': 'fel partikel',
    'w1-q09': 'fel översättning',
    'w1-q01': 'fel böjning',
    'w1-q06': 'fel förfrågan',
    'w1-q02': week.quiz.find((q) => q.id === 'w1-q02')!.answer,
  };

  recordQuizMistakes(week.quiz, answers, update);

  const snapshot = progress.snapshot();

  // 1. Exact vocab mistake registered
  assert.equal(
    snapshot.mistakeVocabIds?.['w1-v04'],
    true,
    'w1-v04 (消す) should be registered in vocab mistakes',
  );
  assert.equal(
    snapshot.mistakeVocabIds?.['w1-v14'],
    true,
    'w1-v14 (開ける) should be registered in vocab mistakes',
  );

  // 2. Exact dojo mistake registered
  assert.equal(
    snapshot.mistakeDojoIds?.['w1-c09'],
    true,
    'w1-c09 (行く) should be registered in dojo mistakes',
  );
  assert.equal(
    snapshot.mistakeDojoIds?.['w1-c12'],
    true,
    'w1-c12 (開ける) should be registered in dojo mistakes',
  );

  // 3. Question answered correctly is NOT in mistakes
  assert.equal(
    snapshot.mistakeDojoIds?.['w1-c06'],
    undefined,
    'w1-c06 (遊ぶ) was answered correctly and must not be marked weak',
  );

  // 4. Critical regression check: "次の駅" in w1-q07 prompt MUST NOT trigger false match on w1-v33 ("つぎ")
  assert.equal(
    snapshot.mistakeVocabIds?.['w1-v33'],
    undefined,
    'w1-v33 (つぎ) must NEVER be flagged as weak from unrelated question',
  );

  // 5. No other accidental entries exist in mistake banks
  assert.deepEqual(Object.keys(snapshot.mistakeVocabIds || {}).sort(), ['w1-v04', 'w1-v14'].sort());
  assert.deepEqual(Object.keys(snapshot.mistakeDojoIds || {}).sort(), ['w1-c09', 'w1-c12'].sort());
});

test('Misstagsbank: Substring kana overlaps without IDs produce zero mistake bank pollution', () => {
  const { progress, update } = setup();

  // Synthetic questions that have prompt substrings matching short kana words: "くに", "いく", "つぎ"
  const trickyQuestions = [
    {
      id: 'mock-q1',
      weekId: 'week-1',
      category: 'grammar' as const,
      prompt: '外国に行きます。次の駅で降ります。',
      choices: ['A', 'B'],
      answer: 'A',
      explanationSv: 'Grammatiktest',
    },
    {
      id: 'mock-q2',
      weekId: 'week-1',
      category: 'vocab' as const,
      prompt: 'Vad betyder つぎ?',
      choices: ['A', 'B'],
      answer: 'A',
      explanationSv: 'Exakt vocabId saknas på mock',
    },
  ];

  recordQuizMistakes(trickyQuestions, { 'mock-q1': 'B', 'mock-q2': 'B' }, update);

  const snapshot = progress.snapshot();
  assert.deepEqual(snapshot.mistakeVocabIds || {}, {});
  assert.deepEqual(snapshot.mistakeDojoIds || {}, {});
});

test('Quiz Choices: Choices are shuffled so the correct answer is not always in the top-left position', () => {
  const week = courseWeeks[0];
  const { drills, quiz } = setup(week);
  const state = quiz();

  assert.equal(state.questions.length, week.quiz.length);

  // 1. All questions keep their choices, answer and content intact
  for (let i = 0; i < state.questions.length; i++) {
    const q = state.questions[i];
    const original = week.quiz[i];
    assert.equal(q.id, original.id);
    assert.equal(q.answer, original.answer);
    assert.equal(q.choices.length, original.choices.length);
    assert.deepEqual(new Set(q.choices), new Set(original.choices));
    assert.ok(q.choices.includes(q.answer));
  }

  // 2. Answer positions are not all at index 0 (top-left)
  const answerIndices = state.questions.map((q) => q.choices.indexOf(q.answer));
  assert.ok(
    answerIndices.some((idx) => idx !== 0),
    'Correct answers must not all be placed at index 0 (top-left corner)',
  );
  const uniquePositions = new Set(answerIndices);
  assert.ok(
    uniquePositions.size > 1,
    'Correct answers should be distributed across multiple choice positions',
  );

  // 3. Choices remain stable during an ongoing quiz session (between reads/re-renders)
  const secondRead = quiz();
  assert.deepEqual(
    secondRead.questions.map((q) => q.choices),
    state.questions.map((q) => q.choices),
    'Choices must not reshuffle mid-session while user is answering',
  );

  // 4. Calling reset re-shuffles choices for the next session
  drills.quiz.reset(week.id);
  const resetRead = quiz();
  assert.equal(resetRead.questions.length, week.quiz.length);
  const resetAnswerIndices = resetRead.questions.map((q) => q.choices.indexOf(q.answer));
  assert.ok(
    resetAnswerIndices.some((idx) => idx !== 0),
    'Reset session answers must also be distributed and not stuck at index 0',
  );
});

test('Dojo Choices: Choices are shuffled so the correct answer position is randomized across boxes', () => {
  const week = courseWeeks[0];
  const { drills, dojo } = setup(week);

  // 1. Traverse all 14 verbs of the week and collect the index of the correct answer
  const answerIndices: number[] = [];
  for (let i = 0; i < week.conjugations.length; i++) {
    const state = dojo();
    const expected = getDojoExpectedForm(state.current, state.targetForm).kana;
    const answerIndex = state.choices.indexOf(expected);
    assert.ok(answerIndex >= 0 && answerIndex < 4, 'Expected answer must be one of the 4 choices');
    answerIndices.push(answerIndex);

    // Stability check: re-reading while answering must NOT change choice positions
    const secondRead = dojo();
    assert.deepEqual(
      secondRead.choices,
      state.choices,
      'Choices must stay stable during active card review',
    );

    // Submit answer and move
    drills.dojo.submit(expected);
    drills.dojo.move(1);
  }

  // 2. Answer positions must be distributed across different boxes (not all in the same box)
  const uniquePositions = new Set(answerIndices);
  assert.ok(
    uniquePositions.size > 1,
    'Correct answers should be distributed across multiple boxes, not fixed to a single box',
  );

  // 3. Reset clears cache and re-shuffles choices
  drills.reset();
  const resetState = dojo();
  assert.equal(resetState.choices.length, 4);
});

test('Kanji Quiz Questions: Generates balanced questions with exactly 4 unique choices including the correct answer', () => {
  const week = courseWeeks[0];
  const questions = buildKanjiQuizQuestions(week.kanji, Math.random, 12);

  assert.ok(questions.length >= 8, 'Should generate a rich set of kanji questions');
  for (const q of questions) {
    assert.equal(q.category, 'kanji');
    assert.equal(q.choices.length, 4, `Question ${q.id} must have exactly 4 choices`);
    const uniqueChoices = new Set(q.choices);
    assert.equal(
      uniqueChoices.size,
      4,
      `Question ${q.id} must have 4 distinct choices without duplicates`,
    );
    assert.ok(
      q.choices.includes(q.answer),
      `Question ${q.id} choices must include the correct answer`,
    );
    assert.ok(q.explanationSv.length > 0, `Question ${q.id} must include an explanation`);
    assert.ok(q.prompt.length > 0, `Question ${q.id} must have a prompt`);
    assert.ok(q.kanjiId, `Question ${q.id} must link to a valid kanji item`);
  }
});

test('Kanji Quiz Drill: Complete session answering, scoring, advancing, and restart', () => {
  const week = courseWeeks[0];
  const { drills, kanjiQuiz } = setup(week);

  // Initial read starts the quiz
  let state = kanjiQuiz();
  assert.ok(state.total > 0, 'Quiz should contain questions');
  assert.equal(state.score, 0);
  assert.equal(state.index, 0);
  assert.equal(state.finished, false);

  const total = state.total;
  let correctCount = 0;

  for (let i = 0; i < total; i++) {
    state = kanjiQuiz();
    const curr = state.current;
    assert.ok(curr);
    assert.equal(state.index, i);

    // Answer every question correctly
    drills.kanjiQuiz.choose(curr.answer);
    correctCount++;

    const afterChoice = kanjiQuiz();
    assert.equal(afterChoice.chosen, curr.answer);

    // Advance
    drills.kanjiQuiz.advance();
  }

  // Quiz must now be finished with full score
  const finalState = kanjiQuiz();
  assert.equal(finalState.finished, true);
  assert.equal(finalState.score, correctCount);
  assert.equal(finalState.score, total);

  // Restarting with start(week) resets cleanly
  drills.kanjiQuiz.start(week);
  const restartedState = kanjiQuiz();
  assert.equal(restartedState.finished, false);
  assert.equal(restartedState.index, 0);
  assert.equal(restartedState.score, 0);
  assert.equal(Object.keys(restartedState.answers).length, 0);
});

test('Kanji Quiz Choices: Random distribution of answer positions across choices', () => {
  const week = courseWeeks[0];
  const questions = buildKanjiQuizQuestions(week.kanji, Math.random, 12);
  const answerIndices = questions.map((q) => q.choices.indexOf(q.answer));

  // The answers must not all be at index 0
  const uniqueIndices = new Set(answerIndices);
  assert.ok(
    uniqueIndices.size > 1,
    'Kanji quiz answers should be distributed across multiple positions (0, 1, 2, 3), not fixed to index 0',
  );
});
