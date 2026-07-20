"use client";

/**
 * `NotifyMeForm` — captura de e-mail "Avise-me no lançamento".
 *
 * Enquanto o app não está publicado, coleta o e-mail de interessados. Envia
 * para a API (`POST /waitlist`) — o build é export estático, então não há rota
 * de servidor Next; o POST vai direto para o FastAPI. Trata os estados de
 * envio/sucesso/erro e valida o formato do e-mail.
 */

import * as React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { siteApiBase } from "@/modules/site/site-config";

type State = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NotifyMeFormProps {
  /** De onde veio o cadastro (ex.: "home", "baixar"). */
  source?: string;
  /** Contraste: sobre fundo claro (default) ou escuro (herói). */
  tone?: "light" | "dark";
  className?: string;
}

export function NotifyMeForm({
  source = "site",
  tone = "light",
  className,
}: NotifyMeFormProps) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<State>("idle");
  const [message, setMessage] = React.useState("");

  const onDark = tone === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setState("error");
      setMessage("Digite um e-mail válido.");
      return;
    }
    setState("submitting");
    setMessage("");
    try {
      const res = await fetch(`${siteApiBase()}/api/v1/site/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("success");
      setMessage("Pronto! Avisaremos você no lançamento.");
      setEmail("");
    } catch {
      setState("error");
      setMessage("Não foi possível cadastrar agora. Tente novamente.");
    }
  };

  if (state === "success") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          onDark ? "text-white" : "text-success",
          className
        )}
        role="status"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="Seu e-mail"
          aria-label="Seu e-mail"
          aria-invalid={state === "error"}
          className={cn(
            "flex-1",
            onDark && "border-transparent bg-white text-foreground"
          )}
        />
        <Button
          type="submit"
          disabled={state === "submitting"}
          className={cn(!onDark && "bg-primary hover:bg-primary/90")}
        >
          {state === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            "Avise-me"
          )}
        </Button>
      </div>
      {state === "error" && message ? (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            onDark ? "text-orange-200" : "text-destructive"
          )}
          role="alert"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
