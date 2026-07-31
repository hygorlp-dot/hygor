export const CHAT_TONES = Object.freeze({
  message: Object.freeze([{ frequency: 880, start: 0 }, { frequency: 660, start: 0.09 }]),
  mention: Object.freeze([{ frequency: 660, start: 0 }, { frequency: 880, start: 0.12 }, { frequency: 1046, start: 0.24 }]),
});

const browserAudioContext = () => globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;

export function playChatMessageSound(AudioContextClass = browserAudioContext()) {
  if (!AudioContextClass) return false;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    for (const tone of CHAT_TONES.message) {
      oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.start);
    }
    gain.gain.setValueAtTime(0.16, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
    oscillator.onended = () => context.close();
    return true;
  } catch {
    return false;
  }
}

export function playChatMentionSound(AudioContextClass = browserAudioContext(), schedule = globalThis.setTimeout) {
  if (!AudioContextClass) return false;
  try {
    const context = new AudioContextClass();
    for (const tone of CHAT_TONES.mention) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.start);
      gain.gain.setValueAtTime(0.18, context.currentTime + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + tone.start + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + tone.start);
      oscillator.stop(context.currentTime + tone.start + 0.22);
    }
    schedule(() => context.close(), 700);
    return true;
  } catch {
    return false;
  }
}
