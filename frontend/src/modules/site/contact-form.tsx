"use client";

/**
 * `ContactForm` — formulário público de contato/suporte.
 *
 * Envia para a API (`POST /contact`) — build estático, POST direto ao FastAPI.
 * Estados de envio/sucesso/erro com validação mínima (nome, e-mail, mensagem).
 */

import * as React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/services/api";

type State = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [state, setState] = React.useState<State>("idle");
  const [error, setError] = React.useState("");

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (state === "error") setState("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      setState("error");
      setError("Preencha nome e mensagem.");
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setState("error");
      setError("Digite um e-mail válido.");
      return;
    }
    setState("submitting");
    setError("");
    try {
      await apiPost("/site/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setState("success");
    } catch {
      setState("error");
      setError("Não foi possível enviar agora. Tente novamente.");
    }
  };

  if (state === "success") {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center"
        role="status"
      >
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h3 className="text-lg font-bold">Mensagem enviada</h3>
        <p className="text-sm text-muted-foreground">
          Obrigado por escrever. Responderemos em breve.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Input
        value={form.name}
        onChange={set("name")}
        placeholder="Nome"
        aria-label="Nome"
        autoComplete="name"
      />
      <Input
        type="email"
        inputMode="email"
        value={form.email}
        onChange={set("email")}
        placeholder="E-mail"
        aria-label="E-mail"
        autoComplete="email"
      />
      <Input
        value={form.subject}
        onChange={set("subject")}
        placeholder="Assunto"
        aria-label="Assunto"
      />
      <Textarea
        value={form.message}
        onChange={set("message")}
        placeholder="Mensagem"
        aria-label="Mensagem"
        rows={5}
      />
      {state === "error" && error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={state === "submitting"}
        className="bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {state === "submitting" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          "Enviar mensagem"
        )}
      </Button>
    </form>
  );
}
