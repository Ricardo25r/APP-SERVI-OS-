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
 *
 * O tipo de conta pode vir pré-selecionado pela Escolha de Perfil (Tela 10)
 * via query string `?role=<customer|professional>` (lida com `useSearchParams`).
 * Por isso o conteúdo fica em `RegisterForm`, envolto em `<Suspense>` na export
 * default (requisito do Next.js 14 para `useSearchParams`).
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuthStore } from "@/store/auth";
import { apiPost } from "@/services/api";
import type { AuthResponse, UserRole } from "@/types";
import {
  AuthLayout,
  FieldError,
  FormError,
  RoleSelector,
  homePathForRole,
  messageFromError,
  toSession,
  useRedirectAuthenticated,
} from "@/modules/auth";

/** Idade em anos a partir de uma data ISO 'YYYY-MM-DD' (null se inválida). */
function ageFromISO(iso: string): number | null {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const m = today.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) age -= 1;
  return age;
}

/* CPF/CNPJ — valida dígitos verificadores (espelha o backend). */
function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/* Máscaras de exibição (o submit envia só dígitos). */
function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  let out = `(${d.slice(0, 2)}) `;
  if (d.length <= 6) {
    out += d.slice(2);
  } else if (d.length <= 10) {
    out += `${d.slice(2, 6)}-${d.slice(6, 10)}`; // fixo: (xx) xxxx-xxxx
  } else {
    out += `${d.slice(2, 7)}-${d.slice(7, 11)}`; // celular: (xx) xxxxx-xxxx
  }
  return out;
}

function maskDocument(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    let out = d.slice(0, 3);
    if (d.length > 3) out += `.${d.slice(3, 6)}`;
    if (d.length > 6) out += `.${d.slice(6, 9)}`;
    if (d.length > 9) out += `-${d.slice(9, 11)}`;
    return out;
  }
  // CNPJ: 00.000.000/0000-00
  let out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}
function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    let total = 0;
    for (let i = 0; i < size; i += 1) total += Number(cpf[i]) * (size + 1 - i);
    const check = ((total * 10) % 11) % 10;
    if (check !== Number(cpf[size])) return false;
  }
  return true;
}
function isValidCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const weights: [number[], number][] = [
    [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 12],
    [[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 13],
  ];
  for (const [w, size] of weights) {
    let total = 0;
    for (let i = 0; i < size; i += 1) total += Number(cnpj[i]) * w[i];
    let check = 11 - (total % 11);
    if (check >= 10) check = 0;
    if (check !== Number(cnpj[size])) return false;
  }
  return true;
}
function isValidDocument(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

const registerSchema = z
  .object({
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
      .refine((v) => {
        const n = v.replace(/\D/g, "").length;
        return n >= 10 && n <= 11;
      }, "Informe um telefone válido com DDD."),
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a senha."),
    role: z.enum(["customer", "professional"], {
      errorMap: () => ({ message: "Selecione o tipo de conta." }),
    }),
    // String ISO 'YYYY-MM-DD' do input date (vazia p/ contratante). Exigida e
    // validada (maioridade) apenas quando o papel é profissional (superRefine).
    birthDate: z.string(),
    document: z.string(),
    gender: z.string(),
    consent: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    // Documento (CPF/CNPJ) obrigatório para todos.
    if (!data.document) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["document"],
        message: "Informe seu CPF ou CNPJ.",
      });
    } else if (!isValidDocument(data.document)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["document"],
        message: "CPF ou CNPJ inválido.",
      });
    }
    // Aceite obrigatório dos Termos e da Política.
    if (!data.consent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent"],
        message: "É necessário aceitar os Termos e a Política.",
      });
    }
    // Data de nascimento: só exigida para profissional.
    if (data.role !== "professional") return;
    if (!data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthDate"],
        message: "Informe sua data de nascimento.",
      });
      return;
    }
    const age = ageFromISO(data.birthDate);
    if (age === null || age > 110) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthDate"],
        message: "Data de nascimento inválida.",
      });
    } else if (age < 18) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthDate"],
        message: "É necessário ter pelo menos 18 anos.",
      });
    }
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

/** Lê o `?role=` da Escolha de Perfil; só aceita os papéis do cadastro. */
function roleFromParam(value: string | null): RegisterValues["role"] {
  return value === "professional" || value === "customer" ? value : "customer";
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasHydrated } = useRedirectAuthenticated();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [formError, setFormError] = useState<string | null>(null);

  // Pré-seleciona o tipo de conta conforme a Tela 10 (Escolha de Perfil).
  const initialRole = roleFromParam(searchParams.get("role"));
  // Indique e ganhe: código do indicador, vindo do link /register?ref=CODE.
  const referralCode = searchParams.get("ref");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: registerResolver,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: initialRole,
      birthDate: "",
      document: "",
      gender: "",
      consent: false,
    },
  });

  // Mantém o campo `role` registrado para validação/submit; o seletor visual
  // (RoleSelector) apenas atualiza esse valor.
  register("role");
  const phoneReg = register("phone");
  const documentReg = register("document");
  const selectedRole = watch("role");

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      const resp = await apiPost<AuthResponse>("/auth/register", {
        name: values.name,
        email: values.email,
        phone: onlyDigits(values.phone),
        password: values.password,
        role: values.role as UserRole,
        birth_date: values.birthDate || undefined,
        document: onlyDigits(values.document) || undefined,
        gender: values.gender || undefined,
        referral_code: referralCode || undefined,
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
      title="Criar conta"
      description="Cadastre-se no FazTudo"
      showMascots
      mascotHeadlineLead={
        selectedRole === "professional"
          ? "Procurando trabalho?"
          : "Precisa de um serviço?"
      }
      mascotHeadlineAccent="Aqui você encontra."
      footer={
        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
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
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            {...phoneReg}
            onChange={(e) => {
              e.target.value = maskPhone(e.target.value);
              return phoneReg.onChange(e);
            }}
          />
          <FieldError id="phone-error" message={errors.phone?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="document">CPF ou CNPJ</Label>
          <Input
            id="document"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="CPF ou CNPJ"
            aria-invalid={Boolean(errors.document)}
            aria-describedby={errors.document ? "document-error" : undefined}
            {...documentReg}
            onChange={(e) => {
              e.target.value = maskDocument(e.target.value);
              return documentReg.onChange(e);
            }}
          />
          <FieldError id="document-error" message={errors.document?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? "confirmPassword-error" : undefined
            }
            {...register("confirmPassword")}
          />
          <FieldError
            id="confirmPassword-error"
            message={errors.confirmPassword?.message}
          />
        </div>

        <div className="space-y-2">
          <span
            id="role-label"
            className="text-sm font-medium leading-none"
          >
            Tipo de conta
          </span>
          <RoleSelector
            value={selectedRole}
            onChange={(role) =>
              setValue("role", role, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            labelledById="role-label"
            invalid={Boolean(errors.role)}
            describedById={errors.role ? "role-error" : undefined}
          />
          <FieldError id="role-error" message={errors.role?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gênero (opcional)</Label>
          <select
            id="gender"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            {...register("gender")}
          >
            <option value="">Prefiro não informar</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {selectedRole === "professional" ? (
          <div className="space-y-2">
            <Label htmlFor="birthDate-dia">Data de nascimento</Label>
            <DateField
              id="birthDate"
              value={watch("birthDate") || ""}
              onChange={(iso) =>
                setValue("birthDate", iso, { shouldValidate: true })
              }
            />
            <FieldError
              id="birthDate-error"
              message={errors.birthDate?.message}
            />
            <p className="text-xs text-muted-foreground">
              Usamos para confirmar que você é maior de 18 anos.
            </p>
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              aria-invalid={Boolean(errors.consent)}
              {...register("consent")}
            />
            <span>
              Li e concordo com a{" "}
              <Link
                href="/privacidade"
                target="_blank"
                className="font-medium text-primary hover:underline"
              >
                Política de Privacidade
              </Link>{" "}
              e os{" "}
              <Link
                href="/termos"
                target="_blank"
                className="font-medium text-primary hover:underline"
              >
                Termos de Uso
              </Link>
              .
            </span>
          </label>
          <FieldError id="consent-error" message={errors.consent?.message} />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}

/**
 * `useSearchParams` exige um limite de Suspense no Next.js 14 (caso contrário a
 * página inteira é forçada a render dinâmico no build). Envolvemos o formulário
 * para preservar a otimização e evitar o erro de build.
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
