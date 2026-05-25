/**
 * Voice guidance (TTS) for turn-by-turn navigation.
 * Uses expo-speech. Speaks current instruction and arrival.
 */

import * as Speech from 'expo-speech';

let muted = false;

export function setVoiceMuted(mute: boolean): void {
  muted = mute;
  if (mute) Speech.stop();
}

export function isVoiceMuted(): boolean {
  return muted;
}

/** Language code for TTS (e.g. 'en', 'fr', 'pt'). Defaults to 'en'. */
export function speakInstruction(
  text: string,
  options?: { force?: boolean; language?: string },
): void {
  if (muted && !options?.force) return;
  if (!text?.trim()) return;
  Speech.stop();
  Speech.speak(text.trim(), {
    language: options?.language ?? 'en',
    pitch: 1,
    rate: 0.9,
  });
}

/** Language code for TTS. Defaults to 'en'. */
export function speakArrival(
  message?: string,
  options?: { language?: string },
): void {
  if (muted) return;
  Speech.stop();
  const lang = options?.language ?? 'en';
  Speech.speak(message?.trim() || 'You have arrived.', {
    language: lang,
    pitch: 1,
    rate: 0.9,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
