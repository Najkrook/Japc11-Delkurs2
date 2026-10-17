export const ttsSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): number {
  if (!ttsSupported()) return 0;
  const voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
  voice =
    voices.find((v) => /natural|online/i.test(v.name)) ||
    voices.find((v) => /google/i.test(v.name)) ||
    voices[0] ||
    null;
  return speechSynthesis.getVoices().length;
}

if (ttsSupported()) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(
  text: string,
  { rate = 0.9, onend }: { rate?: number; onend?: () => void } = {},
): 'ok' | 'no-voice' | 'unsupported' {
  if (!ttsSupported() || !text) return 'unsupported';
  speechSynthesis.cancel();
  const loaded = voice ? 1 : pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  if (voice) u.voice = voice;
  u.rate = rate;
  u.onend = u.onerror = () => onend?.();
  speechSynthesis.speak(u);
  return !voice && loaded ? 'no-voice' : 'ok';
}

export const stopSpeech = (): void => {
  if (ttsSupported()) speechSynthesis.cancel();
};
