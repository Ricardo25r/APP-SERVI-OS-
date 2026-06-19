"use client";

/**
 * Tela de Login do FazTudo.
 *
 * Formulário e-mail + senha. Em sucesso, persiste a sessão (`setAuth`) e
 * redireciona conforme o papel (customer → /leads, professional → /marketplace,
 * admin → /). Mostra erros vindos de `ApiError` (ex.: 401 credenciais inválidas).
 *
 * Usa React Hook Form com validação Zod (resolver manual para não introduzir
 * dependências novas — `@hookform/resolvers` não está no projeto).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import { apiPost } from "@/services/api";
import type { AuthResponse } from "@/types";
import {
  AuthLayout,
  FieldError,
  FormError,
  homePathForRole,
  messageFromError,
  toSession,
  useRedirectAuthenticated,
} from "@/modules/auth";

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

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const resp = await apiPost<AuthResponse>("/auth/login", {
        email: values.email,
        password: values.password,
      });
      const session = toSession(resp);
      setAuth(session);
      router.replace(homePathForRole(session.user.role));
    } catch (error) {
      setFormError(messageFromError(error));
    }
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
    <AuthLayout
      title="Entrar"
      description="Acesse sua conta do FazTudo"
      footer={
        <p className="text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      }
    >
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
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
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
    </AuthLayout>
  );
}
