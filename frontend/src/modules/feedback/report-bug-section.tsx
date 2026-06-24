"use client";

/**
 * `ReportBugSection` — formulário para o usuário (contratante/prestador) reportar
 * um bug. Envia `POST /feedback/report-bug`, que cria um card `tipo=bug`,
 * `origem=usuario` na esteira de Sprints (visível no painel admin).
 */

import { useState } from "react";
import { Bug, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/services/api";

export function ReportBugSection() {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (titulo.trim().length < 3) {
      setError("Descreva o problema em pelo menos 3 caracteres.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiPost("/feedback/report-bug", {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
      });
      setSent(true);
      setTitulo("");
      setDescricao("");
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Bug className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight sm:text-lg">
              Encontrou um bug?
            </h2>
            <p className="text-xs text-muted-foreground">
              Reporte um problema técnico — nossa equipe analisa e corrige.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-success">
            Obrigado! Seu relato foi enviado para a nossa equipe.
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-2 block text-xs font-semibold underline"
            >
              Reportar outro
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bug-titulo">O que aconteceu?</Label>
              <Input
                id="bug-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: o botão de comprar créditos não abre"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bug-desc">Detalhes (opcional)</Label>
              <Textarea
                id="bug-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="Em que tela? O que você fez? O que esperava que acontecesse?"
                maxLength={4000}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={sending} className="gap-1.5">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Enviar relato
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
