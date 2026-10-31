const status = document.querySelector<HTMLElement>('#status')!;
const buttons = document.querySelectorAll<HTMLButtonElement>('button[data-profile]');
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
// Check before importing cloud.ts: an ordinary Vite session must not touch live auth.
const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
if (metaEnv?.MODE !== 'test' || metaEnv?.VITE_FIREBASE_EMULATORS !== 'true' ||
    !['127.0.0.1', 'localhost'].includes(location.hostname)) {
  status.textContent = 'Start this preview with npm run preview:sushi. Local emulators are required.';
} else {
  const { auth } = await import('../../src/cloud.ts');
  const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
  status.textContent = 'Ready. Choose a profile to start or continue playing.';
  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', async () => {
      for (const control of buttons) control.disabled = true;
      status.textContent = 'Opening your test restaurant…';
      try {
        const uid = `sushi-preview-${button.dataset.profile}`;
        const result = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({
          sub: uid, email: `${uid}@example.test`, email_verified: true,
          name: button.dataset.profile === 'fresh' ? 'Ny spelare' : 'Testspelare',
        })));
        if (result.user.uid !== uid) throw new Error('Test profiles are missing. Restart npm run preview:sushi.');
        // Prefer seeded cloud progress over a previous emulator session's local snapshot.
        const { courseStorageKey } = await import('../../src/course/course-state.ts');
        localStorage.removeItem(courseStorageKey(uid));
        location.href = '/?sushi=1#/sushi';
      } catch (error) {
        status.textContent = `Could not open the preview: ${error instanceof Error ? error.message : String(error)}`;
        for (const control of buttons) control.disabled = false;
      }
    });
  }
}
