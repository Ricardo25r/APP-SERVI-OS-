"use client";

/**
 * Tela de Cadastro do FazTudo.
 *
 * Formulário: nome, e-mail, telefone, senha e tipo de conta
 * (Contratante = customer / Profissional = professional). Em sucesso, persiste
 * a sessão (`setAuth`) e redireciona conforme o papel. Mostra erros da API
 * (409 e-mail/telefone em uso, 422 validação).
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
import { Select, SelectOption } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import { apiPost } from "@/services/api";
import type { AuthResponse, UserRole } from "@/types";
import {
  AuthCard,
  FieldError,
  FormError,
  homePathForRole,
  messageFromError,
  toSession,
  useRedirectAuthenticated,
} from "@/modules/auth";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo."),
  email: z
    .string()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido."),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido (com DDD)."),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres."),
  role: z.enum(["customer", "professional"], {
    errorMap: () => ({ message: "Selecione o tipo de conta." }),
  }),
});

type RegisterValues = z.infer<typeof registerSchema>;

/** Resolver Zod manual (substitui `@hookform/resolvers`, ausente no projeto). */
const registerResolver: Resolver<RegisterValues> = async (values) => {
  const parsed = registerSchema.safeParse(values);
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
  return { values: {}, errors: errors as FieldErrors<RegisterValues> };
};

export default function RegisterPage() {
  const router = useRouter();
  const { hasHydrated } = useRedirectAuthenticated();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: registerResolver,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "customer",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      const resp = await apiPost<AuthResponse>("/auth/register", {
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role as UserRole,
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
    <AuthCard
      title="Criar conta"
      description="Cadastre-se no FazTudo"
      footer={
        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={formError} />

        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          <FieldError id="name-error" message={errors.name?.message} />
        </div>

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
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            {...register("phone")}
          />
          <FieldError id="phone-error" message={errors.phone?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Tipo de conta</Label>
          <Select
            id="role"
            aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? "role-error" : undefined}
            {...register("role")}
          >
            <SelectOption value="customer">
              Contratante — quero contratar serviços
            </SelectOption>
            <SelectOption value="professional">
              Profissional — quero oferecer serviços
            </SelectOption>
          </Select>
          <FieldError id="role-error" message={errors.role?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthCard>
  );
}
