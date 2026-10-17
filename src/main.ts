import './course/course.css';
import { courseArenaManager } from './course/multiplayer/arena-service.ts';
import { render } from 'lit-html';
import { login, logout, watchUser } from './cloud.ts';
import { speak as speakJp, stopSpeech, ttsSupported } from './speech.ts';
import { renderCourseShell, syncCourseProgressForUser } from './course/course-view.ts';
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
let currentUser: { uid: string; displayName?: string | null; email?: string | null } | null = null;
let authBusy = false;
let statusText = 'Lokalt sparad';

function applyThemeAttr(theme: 'classic' | 'sakura'): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage quota errors
  }
}

applyThemeAttr(currentTheme);

const host: CourseHostContext = {
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
  get tts() {
    return ttsSupported();
  },
  speak(text: string, btn?: HTMLElement | null) {
    btn?.classList.add('speaking');
    const clear = () => btn?.classList.remove('speaking');
    const result = speakJp(text, { onend: clear });
    if (result !== 'ok') clear();
  },
  toggleTheme() {
    currentTheme = currentTheme === 'sakura' ? 'classic' : 'sakura';
    applyThemeAttr(currentTheme);
    draw();
  },
  async account() {
    if (authBusy) return;
    authBusy = true;
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

watchUser((u) => {
  stopSpeech();
  currentUser = u ? { uid: u.uid, displayName: u.displayName, email: u.email } : null;
  courseArenaManager.bindHost(currentUser, () => draw());
  statusText = u ? `Inloggad som ${u.displayName || u.email || 'student'}` : 'Lokalt sparad';
  syncCourseProgressForUser(u?.uid || null, () => draw());
  draw();
});

draw();
