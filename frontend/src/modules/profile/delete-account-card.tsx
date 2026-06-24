"use client";

/**
 * `DeleteAccountCard` — exclusão de conta self-service (LGPD Art. 18 + exigência
 * das app stores). Pede confirmação digitando "EXCLUIR" para evitar acidente,
 * chama `DELETE /users/me` (anonimiza + desativa no backend), faz logout e
 * redireciona. Ação irreversível.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete } from "@/services/api";
import { useAuthStore } from "@/store/auth";

export function DeleteAccountCard() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const canDelete = confirmText.trim().toUpperCase() === "EXCLUIR";

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">
            Excluir minha conta
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ação permanente. Seus dados pessoais são apagados e os pedidos em
            aberto, cancelados. Não pode ser desfeito.
          </p>

          {!open ? (
            <Button
              variant="outline"
              className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setOpen(true)}
            >
              Excluir minha conta
            </Button>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="confirm-delete" className="text-xs">
                  Para confirmar, digite{" "}
                  <span className="font-bold">EXCLUIR</span>:
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  autoComplete="off"
                />
              </div>
              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setConfirmText("");
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleDelete()}
                  disabled={busy || !canDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Excluir definitivamente
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
