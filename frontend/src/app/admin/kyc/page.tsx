"use client";

/**
 * Painel admin — **Verificações (KYC)** (`/admin/kyc`).
 *
 * Fila de profissionais com KYC pendente. As imagens (documento + selfie) vêm
 * por streaming autenticado (`/kyc/admin/{id}/image/{which}`), buscadas com o
 * token via fetch → blob (um `<img>` não envia o header de auth). Aprovar/recusar.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPatch } from "@/services/api";
import { useAuthStore } from "@/store/auth";

interface PendingItem {
  user_id: string;
  name: string;
  submitted_at: string | null;
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

function ImageBox({ label, userId, which }: { label: string; userId: string; which: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={label}
        className="h-44 w-full rounded-lg border bg-muted object-contain"
      />
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
  async function review(approve: boolean) {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt("Motivo da recusa:");
      if (!reason) return;
    }
    setBusy(true);
    try {
      await apiPatch(`/kyc/admin/${item.user_id}`, { approve, reason });
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
          onClick={() => void review(false)}
          disabled={busy}
          className="flex-1"
        >
          Recusar
        </Button>
      </div>
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
