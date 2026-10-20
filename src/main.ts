import './course/course.css';
import { courseArenaManager } from './course/multiplayer/arena-service.ts';
import { render } from 'lit-html';
import { login, logout, watchUser } from './cloud.ts';
import { speak as speakJp, stopSpeech, ttsSupported } from './speech.ts';
import { renderCourseShell, courseProgress } from './course/course-view.ts';
import { initCourseRouter } from './course/router.ts';
import type { CourseHostContext } from './course/types.ts';

const THEME_STORAGE_KEY = 'japc11-dk2-theme';
const root = document.getElementById('app')!;

function readTheme(): 'classic' | 'sakura' {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'sakura' ? 'sakura' : 'classic';
  } catch {
    return 'classic';
  }
}

let currentTheme: 'classic' | 'sakura' = readTheme();
let currentUser: {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
} | null = null;
let authBusy = false;
let statusText = 'Lokalt sparad';
let authError: string | null = null;
let authErrorTimeout: ReturnType<typeof setTimeout> | null = null;
let speechNotice: string | null = null;
let speechNoticeTimeout: ReturnType<typeof setTimeout> | null = null;

function setAuthError(msg: string | null): void {
  if (authErrorTimeout) {
    clearTimeout(authErrorTimeout);
    authErrorTimeout = null;
  }
  authError = msg;
  if (msg) {
    authErrorTimeout = setTimeout(() => {
      authError = null;
      draw();
    }, 6000);
  }
}

function setSpeechNotice(msg: string | null): void {
  if (speechNoticeTimeout) {
    clearTimeout(speechNoticeTimeout);
    speechNoticeTimeout = null;
  }
  speechNotice = msg;
  if (msg) {
    speechNoticeTimeout = setTimeout(() => {
      speechNotice = null;
      draw();
    }, 4500);
  }
}

function applyThemeAttr(theme: 'classic' | 'sakura'): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage quota errors
  }
}

applyThemeAttr(currentTheme);

export const host: CourseHostContext = {
  get theme() {
    return currentTheme;
  },
  get user() {
    return currentUser;
  },
  get status() {
    return statusText;
  },
  get authBusy() {
    return authBusy;
  },
  get authError() {
    return authError;
  },
  clearAuthError() {
    setAuthError(null);
    draw();
  },
  get speechNotice() {
    return speechNotice;
  },
  clearSpeechNotice() {
    setSpeechNotice(null);
    draw();
  },
  get tts() {
    return ttsSupported();
  },
  onLogin() {
    void host.account();
  },
  speak(text: string, btn?: HTMLElement | null): 'ok' | 'no-voice' | 'unsupported' {
    btn?.classList.add('speaking');
    const clear = () => btn?.classList.remove('speaking');
    const result = speakJp(text, { onend: clear });
    if (result !== 'ok') {
      clear();
      if (result === 'no-voice') {
        const noVoiceMsg = 'Din enhet saknar japansk talsyntesröst';
        statusText = noVoiceMsg;
        setSpeechNotice(noVoiceMsg);
        draw();
      }
    }
    return result;
  },
  toggleTheme() {
    currentTheme = currentTheme === 'sakura' ? 'classic' : 'sakura';
    applyThemeAttr(currentTheme);
    draw();
  },
  async account() {
    if (authBusy) return;
    authBusy = true;
    setAuthError(null);
    draw();
    try {
      if (currentUser) {
        await logout();
        statusText = 'Utloggad (lokalt sparad)';
      } else {
        await login();
      }
    } catch {
      statusText = 'Inloggning avbröts';
      setAuthError('Inloggning avbröts');
    } finally {
      authBusy = false;
      draw();
    }
  },
  announce(msg: string) {
    statusText = msg;
    draw();
  },
  render() {
    draw();
  },
};

export function draw(): void {
  render(renderCourseShell(host), root);
}

export const courseRouter = initCourseRouter({
  progress: courseProgress,
  arenaManager: courseArenaManager,
  host,
});

courseProgress.subscribe(draw);
courseArenaManager.bindHost(null, draw);

watchUser((u) => {
  stopSpeech();
  const isGoogleUser = Boolean(u && !u.isAnonymous);
  currentUser = isGoogleUser
    ? {
        uid: u!.uid,
        displayName: u!.displayName,
        email: u!.email,
        photoURL: u!.photoURL,
      }
    : null;
  if (currentUser) {
    setAuthError(null);
  }
  courseArenaManager.bindHost(currentUser, draw);
  statusText = currentUser
    ? `Inloggad som ${currentUser.displayName || currentUser.email || 'student'}`
    : 'Lokalt sparad';
  void courseProgress.useUser(currentUser?.uid || null);
  draw();
});

draw();
