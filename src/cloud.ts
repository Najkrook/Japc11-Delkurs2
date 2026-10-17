import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
  type User,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

export const PROJECT_ID = 'tentaplugg-japanska-2026';
export const AUTH_DOMAIN = `${PROJECT_ID}.web.app`;

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const emulated = metaEnv?.MODE === 'test' && metaEnv?.VITE_FIREBASE_EMULATORS === 'true';

const app = initializeApp({
  projectId: emulated ? 'demo-tentaplugg' : PROJECT_ID,
  appId: '1:475360574850:web:8ada8aea9c6a8b8555239b',
  apiKey: emulated ? 'fake-api-key' : 'AIzaSyCB22oJUwzWpZi-c8oVXyONqeK1E5Nspao',
  authDomain: AUTH_DOMAIN,
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
