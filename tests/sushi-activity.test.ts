import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRestaurantState } from '../src/course/sushi-game/economy.ts';
import { getRestaurantActivity } from '../src/course/sushi-game/restaurant-scene.ts';

test('activity pacing uses the production bottleneck and is bounded at eight seconds', () => {
  const state = createDefaultRestaurantState('activity', 0);
  assert.equal(getRestaurantActivity(state).cycleSeconds, 12);
  assert.equal(getRestaurantActivity({ ...state, kitchenCapacity: 3 }).cycleSeconds, 11);
  assert.equal(
    getRestaurantActivity({ ...state, kitchenCapacity: 6, serviceCapacity: 2 }).cycleSeconds,
    11,
  );
  assert.equal(
    getRestaurantActivity({ ...state, kitchenCapacity: 6, serviceCapacity: 6 }).cycleSeconds,
    8,
  );
});

test('servings include basic nigiri and only owned recipes, staggered across the guests', () => {
  const state = createDefaultRestaurantState('activity', 0, {
    permanentGrants: ['salmon_nigiri', 'maguro_nigiri'],
    inventory: ['salmon_nigiri'],
  });
  const snapshot = JSON.stringify(state);
  const activity = getRestaurantActivity(state);
  assert.deepEqual(activity.dishes, ['basic_nigiri', 'salmon_nigiri']);
  assert.deepEqual(activity.servings, [
    { dish: 'basic_nigiri', guest: 0 },
    { dish: 'basic_nigiri', guest: 1 },
    { dish: 'salmon_nigiri', guest: 0 },
    { dish: 'salmon_nigiri', guest: 1 },
  ]);
  assert.equal(JSON.stringify(state), snapshot, 'decorative activity cannot mutate saved state');
});
