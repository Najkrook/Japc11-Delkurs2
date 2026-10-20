import type { CourseProgressPersistence } from './course/course-progress.ts';
import {
  courseStorageKey,
  createFreshCourseProgress,
  readCourseProgress,
} from './course/course-state.ts';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
  type User,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore';
import type { CourseProgressData } from './course/types.ts';

export const PROJECT_ID = 'japc11-delkurs2';
export const AUTH_DOMAIN = 'japc11-delkurs2.firebaseapp.com';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const emulated = metaEnv?.MODE === 'test' && metaEnv?.VITE_FIREBASE_EMULATORS === 'true';

const app = initializeApp({
  projectId: emulated ? 'demo-japc11-delkurs2' : PROJECT_ID,
  appId: '1:588751498049:web:b51c11f79f5782bd358fc0',
  apiKey: emulated ? 'fake-api-key' : 'AIzaSyBzS4HEwIHZ09gdfwkS_qpi7KFiuA8MB7s',
  authDomain: AUTH_DOMAIN,
  storageBucket: 'japc11-delkurs2.firebasestorage.app',
  messagingSenderId: '588751498049',
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (emulated) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export async function login(): Promise<unknown> {
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || '';
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(code)) {
      await signInWithRedirect(auth, new GoogleAuthProvider());
      return null;
    }
    throw error;
  }
}

export const logout = (): Promise<void> => signOut(auth);
export const watchUser = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);

export async function ensureAnonymousAuth(): Promise<User | null> {
  try {
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

export async function saveCloudCourseProgress(
  uid: string,
  progress: CourseProgressData,
): Promise<void> {
  try {
    const ref = doc(db, 'users', uid, 'progress', 'course');
    await setDoc(ref, {
      payload: JSON.stringify(progress),
      updatedAt: progress.updatedAt || Date.now(),
    });
  } catch {
    // Offline or unauthenticated fallback stays in localStorage
  }
}

export async function loadCloudCourseProgress(uid: string): Promise<CourseProgressData | null> {
  const ref = doc(db, 'users', uid, 'progress', 'course');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { payload?: string };
  if (!data?.payload) throw new Error('Course progress payload is missing');
  return JSON.parse(data.payload) as CourseProgressData;
}

// Production adapter: local snapshots retain their logical timestamp on hydration.
export const courseProgressPersistence: CourseProgressPersistence = {
  readLocal(uid) {
    try {
      return readCourseProgress(localStorage, uid);
    } catch {
      return createFreshCourseProgress();
    }
  },
  writeLocal(uid, data) {
    try {
      localStorage.setItem(courseStorageKey(uid), JSON.stringify(data));
    } catch {
      /* Private browsing or storage quota; progress remains in memory. */
    }
  },
  readCloud: loadCloudCourseProgress,
  writeCloud: saveCloudCourseProgress,
};
