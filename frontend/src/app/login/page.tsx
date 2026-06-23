"use client";

/**
 * Tela 09 — Login / Cadastro do FazTudo.
 *
 * Layout centralizado em coluna única (mobile-first; no desktop, um card
 * `max-w-md` centralizado — NÃO usa 2 colunas):
 *  - Topo: painel azul (`bg-primary`, cantos arredondados inferiores) com o
 *    wordmark "Faz"+"Tudo" (branco) e a tagline "O jeito fácil de resolver.".
 *  - Card branco sobreposto: boas-vindas + botões sociais (placeholders
 *    "Em breve", pois NÃO há OAuth no backend) + divisor "ou" + formulário
 *    de e-mail/senha + link para a escolha de perfil + rodapé de segurança.
 *
 * A LÓGICA DE AUTH é 100% preservada: React Hook Form com resolver Zod manual
 * (o projeto não usa `@hookform/resolvers`), `apiPost("/auth/login")`,
 * `setAuth`, redirect por papel (`homePathForRole`) e mensagens de erro de
 * `ApiError` via `messageFromError`. Apenas a camada visual mudou.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import { apiPost } from "@/services/api";
import type { AuthResponse } from "@/types";
import {
  FieldError,
  FormError,
  homePathForRole,
  messageFromError,
  toSession,
  useRedirectAuthenticated,
} from "@/modules/auth";
import { GoogleSignInButton } from "@/modules/auth/google-signin-button";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Resolver Zod manual (substitui `@hookform/resolvers`, ausente no projeto). */
const loginResolver: Resolver<LoginValues> = async (values) => {
  const parsed = loginSchema.safeParse(values);
  if (parsed.success) {
    return { values: parsed.data, errors: {} };
  }
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0];
    if (typeof path === "string" && !errors[path]) {
      errors[path] = { type: issue.code, message: issue.message };
    }
  }
  return { values: {}, errors: errors as FieldErrors<LoginValues> };
};

/**
 * Botões de login social.
 *
 * NÃO há OAuth no backend ainda, portanto são placeholders DESABILITADOS com
 * selo "Em breve". Quando o OAuth existir, basta remover `disabled`/badge e
 * ligar o `onClick` ao provedor correspondente. Ícones em SVG inline (sem libs
 * novas).
 */
const SOCIAL_PROVIDERS: ReadonlyArray<{
  id: "google" | "apple" | "whatsapp";
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "google",
    label: "Entrar com Google",
    icon: (
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden focusable="false">
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Entrar com Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden focusable="false">
        <path
          fill="#000000"
          d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.74.88-1.95 1.56-3.08 1.47-.13-1.1.42-2.27 1.08-3.01.74-.86 2.03-1.5 3.12-1.48zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.52-1.54.01-1.93-1.01-4.02-1-2.09.01-2.52 1.02-4.06 1.01-1.73-.02-3.05-1.78-4.04-3.34C-.07 16.62-.36 11.5 1.66 8.78c1.05-1.43 2.71-2.34 4.34-2.34 1.66 0 2.7 1.01 4.07 1.01 1.33 0 2.14-1.01 4.06-1.01 1.45 0 2.99.79 4.08 2.15-3.59 1.97-3.01 7.1-.71 8.47z"
        />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "Entrar com WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden focusable="false">
        <path
          fill="#25D366"
          d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"
        />
        <path
          fill="#FFFFFF"
          d="M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.437-9.884 9.889-9.884a9.82 9.82 0 0 1 6.988 2.898 9.825 9.825 0 0 1 2.892 6.993c-.003 5.45-4.437 9.885-9.885 9.885zm5.426-7.403c-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { hasHydrated } = useRedirectAuthenticated();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: loginResolver,
    defaultValues: { email: "", password: "" },
  });

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const resp = await apiPost<AuthResponse>("/auth/login", {
        email: values.email,
        password: values.password,
      });
      handleSocialSuccess(resp);
    } catch (error) {
      setFormError(messageFromError(error));
    }
  }

  function handleSocialSuccess(resp: AuthResponse) {
    const session = toSession(resp);
    setAuth(session);
    router.replace(homePathForRole(session.user.role));
  }

  // Evita flicker: enquanto não hidratou, não renderiza o formulário.
  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background">
      <div className="w-full max-w-md">
        {/* Painel azul (topo) com cantos arredondados inferiores */}
        <header className="rounded-b-3xl bg-primary px-6 pb-10 pt-12 text-center text-primary-foreground">
          <Link
            href="/"
            aria-label="Página inicial do FazTudo"
            className="inline-flex items-baseline justify-center text-4xl font-extrabold tracking-tight"
          >
            <span>Faz</span>
            <span className="italic">Tudo</span>
          </Link>
          <p className="mt-2 text-sm text-primary-foreground/85">
            O jeito fácil de resolver.
          </p>
        </header>

        {/* Card branco sobreposto */}
        <div className="-mt-6 px-4 pb-10 sm:px-6">
          <div className="rounded-2xl border bg-card p-6 shadow-lg">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bem-vindo ao FazTudo!
              </h1>
              <p className="text-sm text-muted-foreground">
                Entre para encontrar ou oferecer serviços com praticidade e
                segurança.
              </p>
            </div>

            {/* Botões sociais — placeholders "Em breve" (sem OAuth no backend) */}
            <div className="mt-6 space-y-3">
              {SOCIAL_PROVIDERS.map((provider) =>
                provider.id === "google" && googleClientId ? (
                  <GoogleSignInButton
                    key="google"
                    onSuccess={handleSocialSuccess}
                    onError={setFormError}
                  />
                ) : (
                  <button
                    key={provider.id}
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Em breve"
                    className="relative flex h-11 w-full items-center justify-center gap-3 rounded-md border border-input bg-card text-sm font-medium text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="absolute left-4 inline-flex items-center">
                      {provider.icon}
                    </span>
                    <span>{provider.label}</span>
                    <span className="absolute right-3 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Em breve
                    </span>
                  </button>
                )
              )}
            </div>

            {/* Divisor "ou" */}
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ou
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>

            {/* Formulário de e-mail — lógica de auth 100% preservada */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entrar com e-mail
              </p>

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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    href="/recuperar-senha"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  {...register("password")}
                />
                <FieldError
                  id="password-error"
                  message={errors.password?.message}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            {/* Link para a escolha de perfil (NÃO direto para /register) */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Ainda não tem uma conta?{" "}
              <Link
                href="/escolha-perfil"
                className="font-semibold text-primary hover:underline"
              >
                Cadastre-se
              </Link>
            </p>
          </div>

          {/* Rodapé de segurança */}
          <div className="mt-4 flex items-start gap-3 rounded-2xl border bg-secondary/60 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                Seus dados estão protegidos
              </p>
              <p className="text-xs text-muted-foreground">
                Usamos criptografia e seguimos as melhores práticas de
                segurança.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
