"use client";

/**
 * Som de alerta de nova oportunidade / notificação. Os navegadores bloqueiam
 * `play()` sem um gesto do usuário; por isso "destravamos" o áudio no 1º
 * toque/click da sessão (toca mudo e pausa). Depois disso, `playAlertSound`
 * funciona mesmo sem gesto no momento do alerta.
 */

let audio: HTMLAudioElement | null = null;
let unlocked = false;

// Beep tocado a cada alerta: repete 4 vezes, 1 por segundo.
const REPEAT_COUNT = 4;
const REPEAT_INTERVAL_MS = 1000;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio("/sounds/notification.mp3?v=1");
    audio.preload = "auto";
    audio.volume = 0.9;
  }
  return audio;
}

/** Destrava o autoplay (chamar no 1º gesto do usuário). */
export function unlockAlertSound(): void {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  a.muted = true;
  a
    .play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
    })
    .catch(() => {
      a.muted = false;
    });
}

/** Toca o som de alerta: o beep repetido 4 vezes, 1 por segundo (best-effort). */
export function playAlertSound(): void {
  const a = getAudio();
  if (!a) return;
  const beep = () => {
    try {
      a.currentTime = 0;
      void a.play();
    } catch {
      /* autoplay bloqueado: ignora (o popup visual continua aparecendo) */
    }
  };
  beep();
  let count = 1;
  const timer = window.setInterval(() => {
    if (count >= REPEAT_COUNT) {
      window.clearInterval(timer);
      return;
    }
    beep();
    count += 1;
  }, REPEAT_INTERVAL_MS);
}
