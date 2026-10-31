import { createRequire } from 'node:module';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import { createDefaultRestaurantState } from '../src/course/sushi-game/economy.ts';

// Hardcoded emulator destinations: this helper must never seed a live project.
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({ projectId: 'demo-japc11-delkurs2' }, 'sushi-preview-seed');

try {
  const db = getFirestore(app);
  for (const profile of ['fresh', 'progressed']) {
    const uid = `sushi-preview-${profile}`;
    const email = `${uid}@example.test`;
    const displayName = profile === 'fresh' ? 'Ny spelare' : 'Testspelare';
    const existing = await getAuth(app)
      .getUser(uid)
      .catch((error: { code?: string }) => {
        if (error.code === 'auth/user-not-found') return null;
        throw error;
      });
    if (!existing) {
      const imported = await getAuth(app).importUsers([
        {
          uid,
          email,
          displayName,
          emailVerified: true,
          providerData: [{ uid, email, displayName, providerId: 'google.com' }],
        },
      ]);
      if (imported.failureCount) throw new Error(JSON.stringify(imported.errors));
    }
    const restaurantRef = db.doc(`users/${uid}/sushi/restaurant`);
    // Re-running setup keeps any playthrough already in progress.
    if ((await restaurantRef.get()).exists && !process.argv.includes('--reset')) continue;
    const progress = createFreshCourseProgress();
    progress.activeSubView = 'sushi';
    progress.updatedAt = Date.now();
    if (profile === 'progressed') {
      for (const week of courseWeeks.filter(
        (week) => week.lessonNumber >= 6 && week.lessonNumber <= 12,
      )) {
        for (const word of week.vocab) progress.masteredVocabIds[word.id] = true;
        for (const kanji of week.kanji) progress.masteredKanjiIds[kanji.id] = true;
        for (const verb of week.conjugations) progress.masteredDojoIds[verb.id] = true;
        progress.quizBestResults[week.id] = {
          score: week.quiz.length,
          total: week.quiz.length,
          completedAt: Date.now(),
        };
      }
    }
    const restaurant = createDefaultRestaurantState(uid, Date.now());
    if (profile === 'progressed') {
      restaurant.balanceUnits = 50_000 * 60_000;
      // Thirty minutes waiting in the register lets collection be tried immediately.
      restaurant.accountedAtMs -= 30 * 60_000;
      restaurant.periodStartMs = restaurant.accountedAtMs;
    }
    const batch = db.batch();
    batch.set(db.doc(`users/${uid}/progress/course`), {
      payload: JSON.stringify(progress),
      updatedAt: progress.updatedAt,
    });
    batch.set(restaurantRef, restaurant);
    await batch.commit();
    console.log(`Ready: ${displayName} (${uid})`);
  }
} finally {
  await deleteApp(app);
}
