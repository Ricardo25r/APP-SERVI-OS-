"use client";

/**
 * Painel admin — **Verificações (KYC)** (`/admin/kyc`).
 *
 * Fila de profissionais com KYC pendente. As imagens (documento + selfie) vêm
 * por streaming autenticado (`/kyc/admin/{id}/image/{which}`), buscadas com o
 * token via fetch → blob (um `<img>` não envia o header de auth). Aprovar/recusar.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Maximize2,
  RotateCcw,
  ScanFace,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPatch } from "@/services/api";
import { useAuthStore } from "@/store/auth";

interface PendingItem {
  user_id: string;
  name: string;
  submitted_at: string | null;
}

interface FaceMatch {
  score: number | null;
  doc_face: boolean;
  selfie_face: boolean;
  threshold: number;
  available: boolean;
}

/** Interpreta o score em rótulo + classe de cor (assist, não é veredito). */
function faceMatchLabel(fm: FaceMatch): { text: string; cls: string } {
  if (!fm.available)
    return {
      text: "Comparação indisponível",
      cls: "bg-muted text-muted-foreground",
    };
  if (fm.score === null) {
    if (!fm.doc_face)
      return {
        text: "Rosto não detectado no documento",
        cls: "bg-brand/10 text-brand",
      };
    if (!fm.selfie_face)
      return {
        text: "Rosto não detectado na selfie",
        cls: "bg-brand/10 text-brand",
      };
    return {
      text: "Não foi possível comparar",
      cls: "bg-muted text-muted-foreground",
    };
  }
  const s = fm.score;
  if (s >= 0.45)
    return {
      text: `Alta semelhança (${s.toFixed(2)})`,
      cls: "bg-success/10 text-success",
    };
  if (s >= fm.threshold)
    return {
      text: `Provável semelhança (${s.toFixed(2)})`,
      cls: "bg-brand/10 text-brand",
    };
  return {
    text: `Baixa semelhança (${s.toFixed(2)}) — confira`,
    cls: "bg-destructive/10 text-destructive",
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function loadImage(userId: string, which: string): Promise<string | null> {
  const token = useAuthStore.getState().accessToken;
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/kyc/admin/${userId}/image/${which}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/**
 * Visualizador em tela cheia com zoom (botões, scroll do mouse, clique e
 * arrastar para mover). Modal do próprio sistema — fecha no X ou Esc.
 */
function ImageViewer({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );

  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };
  const zoomBy = (delta: number) =>
    setScale((s) => {
      const next = Math.min(5, Math.max(1, Math.round((s + delta) * 100) / 100));
      if (next === 1) {
        setTx(0);
        setTy(0);
      }
      return next;
    });

  // Fecha no Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (scale === 1) return;
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    if (!drag.current) return;
    setTx(drag.current.tx + (e.clientX - drag.current.x));
    setTy(drag.current.ty + (e.clientY - drag.current.y));
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} em tela cheia`}
    >
      <div className="flex items-center justify-between gap-2 p-3 text-white">
        <span className="truncate text-sm font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(-0.3)}
            aria-label="Diminuir zoom"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <ZoomOut className="h-5 w-5" aria-hidden />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-white/80">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.3)}
            aria-label="Aumentar zoom"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <ZoomIn className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Redefinir zoom"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <RotateCcw className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <div
        className="relative flex-1 overflow-hidden"
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 0.3 : -0.3)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          draggable={false}
          onClick={() => (scale === 1 ? setScale(2.5) : reset())}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute left-1/2 top-1/2 max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
            cursor: scale > 1 ? "grab" : "zoom-in",
          }}
        />
      </div>
    </div>
  );
}

function ImageBox({ label, userId, which }: { label: string; userId: string; which: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  if (url) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Ampliar ${label}`}
          className="group relative block h-44 w-full overflow-hidden rounded-lg border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-full w-full object-contain" />
          <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-90">
            <Maximize2 className="h-4 w-4" aria-hidden />
          </span>
        </button>
        {open ? (
          <ImageViewer url={url} label={label} onClose={() => setOpen(false)} />
        ) : null}
      </>
    );
  }
  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        setUrl(await loadImage(userId, which));
        setLoading(false);
      }}
      className="flex h-44 w-full items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : (
        `Ver ${label}`
      )}
    </button>
  );
}

function KycRow({ item, onDone }: { item: PendingItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [fm, setFm] = useState<FaceMatch | null>(null);
  const [fmLoading, setFmLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function runFaceMatch() {
    setFmLoading(true);
    try {
      setFm(
        await apiGet<FaceMatch>(`/kyc/admin/${item.user_id}/face-match`)
      );
    } catch {
      setFm({
        score: null,
        doc_face: false,
        selfie_face: false,
        threshold: 0.363,
        available: false,
      });
    } finally {
      setFmLoading(false);
    }
  }

  async function review(approve: boolean, rejectReason: string | null = null) {
    setBusy(true);
    try {
      await apiPatch(`/kyc/admin/${item.user_id}`, {
        approve,
        reason: rejectReason,
      });
      setRejecting(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">{item.name}</p>
        <span className="text-xs text-muted-foreground">
          {item.submitted_at
            ? new Date(item.submitted_at).toLocaleDateString("pt-BR")
            : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ImageBox label="Documento" userId={item.user_id} which="document" />
        <ImageBox label="Selfie" userId={item.user_id} which="selfie" />
      </div>

      <div className="space-y-1">
        {fm ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              faceMatchLabel(fm).cls
            )}
          >
            <ScanFace className="h-3.5 w-3.5" aria-hidden />
            {faceMatchLabel(fm).text}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void runFaceMatch()}
            disabled={fmLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {fmLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ScanFace className="h-3.5 w-3.5" aria-hidden />
            )}
            Comparar rostos
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">
          Auxílio automático — a decisão final é sua.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => void review(true)}
          disabled={busy}
          className="flex-1"
        >
          Aprovar
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setReason("");
            setRejecting(true);
          }}
          disabled={busy}
          className="flex-1"
        >
          Recusar
        </Button>
      </div>

      {rejecting ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
            <p className="text-base font-bold tracking-tight text-foreground">
              Recusar verificação
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe o motivo da recusa. O profissional verá esta mensagem.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Ex: documento ilegível, selfie não confere com o documento..."
              className="mt-3 w-full rounded-lg border border-input bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setRejecting(false)}
                disabled={busy}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => void review(false, reason.trim())}
                disabled={busy || !reason.trim()}
                className="flex-1"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Confirmar recusa
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminKycPage() {
  const auth = useRequireAuth("admin");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "kyc"],
    queryFn: () =>
      apiGet<{ items: PendingItem[]; total: number }>("/kyc/admin/pending"),
    enabled: auth.isAdmin,
  });

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar ao painel
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Verificações (KYC)</h1>
        <p className="text-muted-foreground">
          Profissionais aguardando análise de documentos.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma verificação pendente.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <KycRow
              key={item.user_id}
              item={item}
              onDone={() =>
                queryClient.invalidateQueries({ queryKey: ["admin", "kyc"] })
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
