"use client";

/**
 * Tela de **Recuperar senha** (`/recuperar-senha`) — Tela 27 do design (auth).
 *
 * Pública. Fluxo em até 2 passos:
 *
 *  1. **Solicitar:** campo e-mail → `POST /auth/password-reset/request`
 *     (via `apiPost`). A resposta é **sempre genérica** (anti-enumeração — não
 *     revela se o e-mail existe). Mostramos uma mensagem de sucesso neutra.
 *
 *  2. **Redefinir (dev/MVP):** fora de produção, o backend devolve
 *     `reset_token` no corpo (ver `PasswordResetRequestOut` em
 *     `backend/app/schemas/auth.py` + contrato §7). Quando vier, exibimos o
 *     segundo passo (nova senha) que chama
 *     `POST /auth/password-reset/confirm` com `{ reset_token, new_password }`
 *     → `204`. Em produção (`reset_token` ausente), o usuário recebe o token
 *     por e-mail quando o notification-engine existir.
 *
 * Layout no estilo das telas de auth (`AuthLayout`: card branco + wordmark).
 * Resolver Zod manual (sem `@hookform/resolvers`, ausente no projeto), igual ao
 * login.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, KeyRound, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/services/api";
import {
  AuthLayout,
  FieldError,
  FormError,
  messageFromError,
  useRedirectAuthenticated,
} from "@/modules/auth";

/* ------------------------------------------------------------------ */
/* Shapes da API (ver backend/app/schemas/auth.py)                    */
/* ------------------------------------------------------------------ */

/** Resposta de `POST /auth/password-reset/request`. */
interface PasswordResetRequestOut {
  message: string;
  /** Conveniência de dev/MVP — só vem fora de produção e se o e-mail existir. */
  reset_token?: string | null;
}

/* ------------------------------------------------------------------ */
/* Passo 1 — solicitar (e-mail)                                       */
/* ------------------------------------------------------------------ */

const requestSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("E-mail inválido."),
});
type RequestValues = z.infer<typeof requestSchema>;

const requestResolver: Resolver<RequestValues> = async (values) => {
  const parsed = requestSchema.safeParse(values);
  if (parsed.success) return { values: parsed.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0];
    if (typeof path === "string" && !errors[path]) {
      errors[path] = { type: issue.code, message: issue.message };
    }
  }
  return { values: {}, errors: errors as FieldErrors<RequestValues> };
};

/* ------------------------------------------------------------------ */
/* Passo 2 — redefinir (nova senha) — só no caminho dev (token vindo) */
/* ------------------------------------------------------------------ */

const confirmSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .max(128, "A senha é muito longa."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  });
type ConfirmValues = z.infer<typeof confirmSchema>;

const confirmResolver: Resolver<ConfirmValues> = async (values) => {
  const parsed = confirmSchema.safeParse(values);
  if (parsed.success) return { values: parsed.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0];
    if (typeof path === "string" && !errors[path]) {
      errors[path] = { type: issue.code, message: issue.message };
    }
  }
  return { values: {}, errors: errors as FieldErrors<ConfirmValues> };
};

/* ------------------------------------------------------------------ */
/* Página                                                             */
/* ------------------------------------------------------------------ */

type Stage = "request" | "sent" | "reset" | "done";

export default function RecuperarSenhaPage() {
  const { hasHydrated } = useRedirectAuthenticated();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("request");
  // Token dev devolvido pelo backend fora de produção (habilita o passo 2).
  const [resetToken, setResetToken] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      description="Enviaremos instruções para redefinir sua senha"
      footer={
        <p className="text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline"
          >
            Voltar ao login
          </Link>
        </p>
      }
    >
      {stage === "request" ? (
        <RequestStep
          onSent={(token) => {
            // Caminho dev: token presente → habilita redefinição inline.
            // Caminho produção: sem token → tela de "verifique seu e-mail".
            if (token) {
              setResetToken(token);
              setStage("reset");
            } else {
              setStage("sent");
            }
          }}
        />
      ) : null}

      {stage === "sent" ? <SentStep /> : null}

      {stage === "reset" && resetToken ? (
        <ResetStep resetToken={resetToken} onDone={() => setStage("done")} />
      ) : null}

      {stage === "done" ? (
        <DoneStep onGoToLogin={() => router.replace("/login")} />
      ) : null}
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Passo 1: formulário de e-mail                                      */
/* ------------------------------------------------------------------ */

function RequestStep({
  onSent,
}: {
  onSent: (resetToken: string | null) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: requestResolver,
    defaultValues: { email: "" },
  });

  async function onSubmit(values: RequestValues) {
    setFormError(null);
    try {
      const resp = await apiPost<PasswordResetRequestOut>(
        "/auth/password-reset/request",
        { email: values.email }
      );
      // `reset_token` só vem fora de produção (dev/MVP). Em produção é null.
      onSent(resp?.reset_token ?? null);
    } catch (error) {
      setFormError(messageFromError(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormError message={formError} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Enviando..." : "Enviar instruções"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Estado "enviado" (produção: sem token no corpo)                    */
/* ------------------------------------------------------------------ */

function SentStep() {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
        <MailCheck className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Verifique seu e-mail</p>
        <p className="text-sm text-muted-foreground">
          Se o e-mail informado existir em nossa base, você receberá um link
          para redefinir sua senha. Confira também a caixa de spam.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Voltar ao login
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Passo 2: nova senha (dev — token devolvido pelo backend)           */
/* ------------------------------------------------------------------ */

function ResetStep({
  resetToken,
  onDone,
}: {
  resetToken: string;
  onDone: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmValues>({
    resolver: confirmResolver,
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ConfirmValues) {
    setFormError(null);
    try {
      // 204 No Content em sucesso.
      await apiPost<void>("/auth/password-reset/confirm", {
        reset_token: resetToken,
        new_password: values.newPassword,
      });
      onDone();
    } catch (error) {
      setFormError(messageFromError(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Recebemos sua solicitação. Defina uma nova senha para concluir.
        </span>
      </div>

      <FormError message={formError} />

      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          aria-invalid={Boolean(errors.newPassword)}
          aria-describedby={
            errors.newPassword ? "new-password-error" : undefined
          }
          {...register("newPassword")}
        />
        <FieldError
          id="new-password-error"
          message={errors.newPassword?.message}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={
            errors.confirmPassword ? "confirm-password-error" : undefined
          }
          {...register("confirmPassword")}
        />
        <FieldError
          id="confirm-password-error"
          message={errors.confirmPassword?.message}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Sucesso final                                                      */
/* ------------------------------------------------------------------ */

function DoneStep({ onGoToLogin }: { onGoToLogin: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Senha redefinida!</p>
        <p className="text-sm text-muted-foreground">
          Sua senha foi alterada com sucesso. Faça login com a nova senha.
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        onClick={onGoToLogin}
        className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
      >
        Ir para o login
      </Button>
    </div>
  );
}
