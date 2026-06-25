"use client";

/**
 * `DeleteAccountButton` — exclusão de conta self-service (LGPD Art. 18 +
 * exigência das app stores). Apenas o BOTÃO "Excluir minha conta"; ao tocar,
 * abre uma confirmação enxuta (digitar "EXCLUIR") por segurança — a ação é
 * irreversível: `DELETE /users/me` (anonimiza + desativa), logout e redirect.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiDelete } from "@/services/api";
import { useAuthStore } from "@/store/auth";

export function DeleteAccountButton() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim().toUpperCase() === "EXCLUIR";

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete("/users/me");
      logout();
      router.replace("/");
    } catch {
      setError(
        "Não foi possível excluir a conta. Tente de novo ou fale com o suporte."
      );
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        Excluir minha conta
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
            <p className="text-base font-bold text-foreground">
              Excluir minha conta?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ação permanente e irreversível. Para confirmar, digite{" "}
              <span className="font-bold">EXCLUIR</span>.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EXCLUIR"
              autoComplete="off"
              className="mt-3"
            />
            {error ? (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleDelete()}
                disabled={busy || !canDelete}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
