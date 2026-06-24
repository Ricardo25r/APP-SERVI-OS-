"use client";

/**
 * Som de alerta de nova oportunidade / notificação. Os navegadores bloqueiam
 * `play()` sem um gesto do usuário; por isso "destravamos" o áudio no 1º
 * toque/click da sessão (toca mudo e pausa). Depois disso, `playAlertSound`
 * funciona mesmo sem gesto no momento do alerta.
 */

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio("/sounds/new-opportunity.wav");
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

/** Toca o som de alerta (best-effort). */
export function playAlertSound(): void {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play();
  } catch {
    /* autoplay bloqueado: ignora (o popup visual continua aparecendo) */
  }
}
