"use client";

/**
 * `SelfieCapture` — captura a selfie do KYC AO VIVO pela câmera frontal, com uma
 * máscara oval para enquadrar o rosto (estilo gov.br). Não aceita foto da
 * galeria: a foto é tirada na hora (anti-fraude). Em caso de câmera
 * indisponível/negada, mostra erro claro. Devolve um `File` via `onCapture`.
 */

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SelfieCapture({
  onCapture,
}: {
  onCapture: (file: File | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  // Liga o stream ao <video> quando o modal abre.
  useEffect(() => {
    if (open && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [open]);

  async function startCamera() {
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setOpen(true);
    } catch {
      setError(
        "Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador/app e tente de novo."
      );
    } finally {
      setStarting(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Desenha o frame REAL (não espelhado) — o preview é espelhado só na tela.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        onCapture(file);
        // A foto do rosto NÃO fica visível — guardamos só o anexo e sinalizamos
        // que foi capturada (privacidade; o preview não é exibido).
        setCaptured(true);
        stopCamera();
        setOpen(false);
      },
      "image/jpeg",
      0.92
    );
  }

  function close() {
    stopCamera();
    setOpen(false);
  }

  function retake() {
    setCaptured(false);
    onCapture(null);
    void startCamera();
  }

  return (
    <div className="space-y-2">
      {captured ? (
        // Sem preview da foto do rosto — exibimos apenas que o anexo foi feito.
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <Check className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-success">Selfie anexada</p>
            <button
              type="button"
              onClick={retake}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Tirar outra
            </button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => void startCamera()}
          disabled={starting}
          className="gap-2"
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
          Tirar selfie agora
        </Button>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[95] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {/* Máscara oval (escurece tudo menos o rosto) */}
          <div
            className="pointer-events-none absolute left-1/2 top-[42%] h-[58vh] max-h-[34rem] w-[82vw] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/80"
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          />
          <p className="absolute inset-x-0 bottom-32 px-6 text-center text-sm font-medium text-white">
            Posicione seu rosto dentro do círculo e toque para capturar.
          </p>
          <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={capture}
              aria-label="Capturar selfie"
              className="h-16 w-16 rounded-full border-4 border-white bg-white/25 active:scale-95"
            />
            <button
              type="button"
              onClick={close}
              className="text-sm font-medium text-white/80"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
