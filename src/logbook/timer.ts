import { el } from '../ui/build';

/**
 * Pausentimer und Hinweisleiste des Logbuch Formulars (Phase 20.3).
 *
 * Die Leiste sitzt fest unten ueber der Navigation. Am Ende ertoent ein Signal
 * ueber WebAudio. Der Bildschirm bleibt nur an, solange der Timer laeuft.
 */

const TICK_MS = 250;
const EXTEND_SECONDS = 30;
const TOAST_MS = 2600;
const SECONDS_PER_MINUTE = 60;

/** Signal: drei Toene. */
const BEEP_OFFSETS_S = [0, 0.25, 0.5] as const;
const BEEP_LENGTH_S = 0.15;
const BEEP_HZ = 880;
const BEEP_GAIN = 0.25;

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

let audio: AudioContext | null = null;
let wakeLock: WakeLockSentinel | null = null;

/** Muss aus einer Tippgeste kommen, sonst sperrt der Browser den Ton. */
export function unlockAudio(): void {
  try {
    audio ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // Ohne Ton laeuft der Timer trotzdem.
  }
}

function beep(): void {
  const context = audio;
  if (!context) return;
  try {
    for (const offset of BEEP_OFFSETS_S) {
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = BEEP_HZ;
      gain.gain.value = BEEP_GAIN;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + BEEP_LENGTH_S);
    }
  } catch {
    // Ohne Ton laeuft der Timer trotzdem.
  }
}

async function holdScreen(): Promise<void> {
  try {
    wakeLock ??= (await navigator.wakeLock?.request('screen')) ?? null;
    wakeLock?.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    // Wake Lock ist freiwillig.
  }
}

function releaseScreen(): void {
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

export interface Overlay {
  /** Leiste und Hinweis, einmal in die Seite haengen. */
  element: HTMLElement;
  startTimer: (seconds: number, label: string) => void;
  stopTimer: () => void;
  toast: (text: string) => void;
}

export function createOverlay(): Overlay {
  const label = el('span', { class: 'lb-timer-label' });
  const value = el('span', { class: 'lb-timer-value num' });
  const plus = el('button', { class: 'btn btn-tap', text: `+${EXTEND_SECONDS} s`, attrs: { type: 'button' } });
  const done = el('button', { class: 'btn btn-tap', text: 'Fertig', attrs: { type: 'button' } });
  const bar = el('div', { class: 'lb-timer', attrs: { role: 'timer', hidden: '' } }, [
    el('div', { class: 'lb-timer-text' }, [label, value]), plus, done,
  ]);
  const toastBox = el('div', { class: 'lb-toast', attrs: { role: 'status', hidden: '' } });

  let end = 0;
  let interval: number | undefined;
  let toastTimer: number | undefined;
  let rang = false;

  const tick = (): void => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    value.textContent = formatClock(left);
    if (left === 0 && !rang) {
      rang = true;
      bar.classList.add('is-zero');
      label.textContent = 'Nächster Satz';
      window.clearInterval(interval);
      releaseScreen();
      beep();
    }
  };
  const stopTimer = (): void => {
    window.clearInterval(interval);
    bar.hidden = true;
    releaseScreen();
  };
  const startTimer = (seconds: number, text: string): void => {
    end = Date.now() + seconds * 1000;
    rang = false;
    label.textContent = text;
    bar.classList.remove('is-zero');
    bar.hidden = false;
    window.clearInterval(interval);
    tick();
    interval = window.setInterval(tick, TICK_MS);
    void holdScreen();
  };

  plus.addEventListener('click', () => {
    if (rang) startTimer(EXTEND_SECONDS, 'Pause');
    else {
      end += EXTEND_SECONDS * 1000;
      tick();
    }
  });
  done.addEventListener('click', stopTimer);

  const toast = (text: string): void => {
    toastBox.textContent = text;
    toastBox.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastBox.hidden = true;
    }, TOAST_MS);
  };

  return { element: el('div', { class: 'lb-overlay' }, [bar, toastBox]), startTimer, stopTimer, toast };
}
