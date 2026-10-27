import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import { SUSHI_CATALOG, previewCatalogPurchase } from '../src/course/sushi-game/catalog.ts';
import { createDefaultRestaurantState } from '../src/course/sushi-game/economy.ts';
import { InMemorySushiRepository, sushiService } from '../src/course/sushi-game/service.ts';
import {
  leaveSushiView,
  renderSushiShell,
  SushiClientController,
} from '../src/course/sushi-game/sushi-view.ts';
import type { CourseHostContext, CourseProgressData } from '../src/course/types.ts';

function textOf(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (typeof value === 'object' && 'strings' in value && 'values' in value) {
    const { strings, values } = value as { strings: string[]; values: unknown[] };
    return strings
      .map((part, i) => part + textOf(values[i]))
      .join('')
      .replace(/\s+/g, ' ');
  }
  return '';
}

test('goal shows chapter progress, purchase state and completion without inventing progress', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);
  const host: CourseHostContext = {
    theme: 'classic',
    toggleTheme() {},
    user: { uid: 'usability-goal' },
    account() {},
    speak: () => 'ok',
    tts: true,
    status: '',
    render() {},
    announce() {},
  };
  const state = createDefaultRestaurantState(host.user!.uid, Date.now());
  const render = async (progress: CourseProgressData | null) => {
    renderSushiShell(host, () => {}, progress);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const all = textOf(renderSushiShell(host, () => {}, progress));
    return all.slice(all.indexOf('data-testid="sushi-next-goal"'), all.indexOf('sushi-guest-hint'));
  };
  await repo.set(state);
  let goal = await render(null);
  assert.match(goal, /Kapitel 6 · Brons \(60 %\)/);
  assert.doesNotMatch(goal, /% klart/);
  goal = await render(createFreshCourseProgress());
  assert.match(goal, /0 % klart/);
  assert.match(goal, /0 \/ 21 belöningar köpta/);
  const progress = createFreshCourseProgress();
  progress.masteredVocabIds[courseWeeks[0].vocab[0].id] = true;
  goal = await render(progress);
  assert.match(goal, /1 % klart/);

  leaveSushiView();
  await repo.set({ ...state, permanentGrants: ['prep_counter'] });
  goal = await render(null);
  assert.match(goal, /¥ 50 · Öppna butik/);
  assert.match(goal, /Ger \+10 ¥\/min direkt \(10 → 20\)/);

  leaveSushiView();
  await repo.set({
    ...state,
    permanentGrants: ['prep_counter'],
    inventory: ['prep_counter'],
    kitchenCapacity: 3,
  });
  goal = await render(null);
  assert.match(goal, /Bygg vidare/);
  assert.match(goal, /Inred/);
  assert.doesNotMatch(goal, /Laxnigiri/);
  assert.match(goal, /Precisionskniv/);
  assert.match(goal, /Kapitel 8 · Brons/);
  assert.match(goal, /Ger \+2 ¥\/min direkt \(20 → 22\)/);
  assert.match(goal, /1 \/ 21 belöningar köpta/);

  // With nonsequential grants, useful service relief wins over a cheap cosmetic
  // and the knife's smaller revenue increase at the existing service bottleneck.
  leaveSushiView();
  await repo.set({
    ...state,
    inventory: ['prep_counter'],
    kitchenCapacity: 3,
    permanentGrants: ['prep_counter', 'salmon_nigiri', 'precision_knife', 'conveyor_belt'],
    balanceUnits: 4_000 * 60_000,
  });
  goal = await render(null);
  assert.match(goal, /Nästa renovering/);
  assert.match(goal, /Nivå 2\/3/);
  assert.doesNotMatch(goal, /Laxnigiri/);

  leaveSushiView();
  await repo.set({
    ...state,
    permanentGrants: SUSHI_CATALOG.map((item) => item.id),
    inventory: SUSHI_CATALOG.map((item) => item.id),
  });
  goal = await render(null);
  assert.match(goal, /Restaurangen är komplett/);
  assert.match(goal, /21 \/ 21 belöningar köpta/);
  leaveSushiView();
});

test('pronunciation passes Japanese to speech and reports unavailable speech', () => {
  let spoken = '';
  let result: 'ok' | 'no-voice' | 'unsupported' = 'ok';
  const host: CourseHostContext = {
    theme: 'classic',
    toggleTheme() {},
    user: { uid: 'speech-test' },
    account() {},
    speak: (text) => {
      spoken = text;
      return result;
    },
    tts: true,
    status: '',
    render() {},
    announce() {},
  };
  const controller = new SushiClientController();
  controller.init('speech-test', host);
  controller.speakPhrase('いらっしゃいませ！');
  assert.equal(spoken, 'いらっしゃいませ！');
  assert.equal(controller.speechError, '');
  result = 'no-voice';
  controller.speakPhrase('いらっしゃいませ！');
  assert.match(controller.speechError, /japansk talsyntesröst/);
  result = 'unsupported';
  controller.speakPhrase('いらっしゃいませ！');
  assert.match(controller.speechError, /stöds inte/);
  controller.reset();
});

test('purchase previews reflect current kitchen and service bottlenecks', () => {
  const initial = createDefaultRestaurantState('impact', Date.now());
  const prep = previewCatalogPurchase(initial, 'prep_counter')!;
  assert.equal(prep.newKitchenCapacity, 3);
  assert.equal(prep.yenDelta, 10);
  const service = previewCatalogPurchase(initial, 'conveyor_belt')!;
  assert.equal(service.newServiceCapacity, 4);
  assert.equal(service.yenDelta, 0);
  assert.match(service.educationalExplanation, /köket producerar bara 1/);
  const knife = previewCatalogPurchase(
    { ...initial, kitchenCapacity: 4, serviceCapacity: 2 },
    'precision_knife',
  )!;
  assert.equal(knife.newKitchenCapacity, 5);
  assert.equal(knife.yenDelta, 2);
  assert.match(knife.educationalExplanation, /från 10 till 11 ¥\/order/);
  assert.match(knife.educationalExplanation, /från 20 till 22 ¥\/min/);
});
