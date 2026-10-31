import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRestaurantState } from '../src/course/sushi-game/economy.ts';
import { renderRestaurantScene } from '../src/course/sushi-game/restaurant-scene.ts';
import { InMemorySushiRepository, sushiService } from '../src/course/sushi-game/service.ts';
import { SushiClientController } from '../src/course/sushi-game/sushi-view.ts';
import type { CourseHostContext } from '../src/course/types.ts';

function markup(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(markup).join('');
  if (typeof value === 'object' && 'strings' in value && 'values' in value) {
    const template = value as { strings: string[]; values: unknown[] };
    return template.strings.map((part, index) => part + markup(template.values[index])).join('');
  }
  return '';
}

test('an unowned preview replaces only its slot without changing restaurant ownership or equipment', () => {
  const state = createDefaultRestaurantState('preview', 0, {
    inventory: ['paper_lantern', 'potted_plant'],
    equipped: { wallSlot: 'paper_lantern', floorSlot: 'potted_plant' },
  });
  const before = JSON.stringify(state);
  const preview = markup(renderRestaurantScene(state, { previewDecorationId: 'wave_print' }));
  assert.ok(preview.includes('data-testid="art-wave_print"'));
  assert.ok(preview.includes('data-testid="art-potted_plant"'));
  assert.ok(!preview.includes('data-testid="art-paper_lantern"'));
  assert.ok(preview.includes('Förhandsvisning av din restaurang'));
  assert.equal(JSON.stringify(state), before);
  const normal = markup(renderRestaurantScene(state));
  assert.ok(normal.includes('data-testid="art-paper_lantern"'));
  assert.ok(!normal.includes('data-testid="art-wave_print"'));
  const invalid = markup(renderRestaurantScene(state, { previewDecorationId: 'conveyor_belt' }));
  assert.ok(!invalid.includes('data-testid="art-conveyor-belt"'));
});

test('preview and browsing never write; placement requires ownership and recovers from failure', async () => {
  const repository = new InMemorySushiRepository();
  sushiService.setRepository(repository);
  const uid = 'preview-controller';
  await repository.set(
    createDefaultRestaurantState(uid, Date.now(), {
      inventory: ['paper_lantern'],
      permanentGrants: ['paper_lantern'],
    }),
  );
  const host = { render() {}, speak() {}, user: { uid } } as CourseHostContext;
  const controller = new SushiClientController();
  controller.init(uid, host);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const initial = JSON.stringify(await repository.get(uid));
  controller.previewDecoration('conveyor_belt');
  assert.equal(controller.previewDecorationId, null);
  controller.previewDecoration('wave_print');
  await controller.placePreviewDecoration();
  assert.equal(JSON.stringify(await repository.get(uid)), initial);
  controller.previewDecoration('paper_lantern');
  controller.cycleDecorationPreview(-1);
  assert.equal(controller.previewDecorationId, 'golden_maneki_neko');
  controller.cycleDecorationPreview(1);
  assert.equal(controller.previewDecorationId, 'paper_lantern');
  assert.equal(JSON.stringify(await repository.get(uid)), initial);

  const transaction = repository.transaction.bind(repository);
  repository.transaction = async () => {
    throw new Error('Offline');
  };
  await controller.placePreviewDecoration();
  assert.equal(controller.previewDecorationId, 'paper_lantern');
  assert.equal(controller.state?.equipped.wallSlot, null);
  assert.ok(controller.equipError);
  repository.transaction = transaction;
  await controller.placePreviewDecoration();
  assert.equal(controller.previewDecorationId, null);
  assert.equal((await repository.get(uid))?.equipped.wallSlot, 'paper_lantern');
  assert.deepEqual(controller.state?.inventory, ['paper_lantern']);
  controller.previewDecoration('potted_plant');
  controller.reset();
  assert.equal(controller.previewDecorationId, null);
});
