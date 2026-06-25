"use client";

/**
 * `UsersTable` — gestão de usuários (admin).
 *
 * Filtros por papel/status/busca (aplicados via submit, não a cada tecla) e
 * ações de status (ativar / suspender / bloquear) com confirmação e motivo
 * opcional. Em telas estreitas a tabela rola horizontalmente.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Search,
  ShieldBan,
  ShieldCheck,
  ShieldX,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole, UserStatus } from "@/types";

import {
  deleteUser,
  fetchUsers,
  updateUserRole,
  updateUserStatus,
} from "../api";
import type { AdminUser, UsersFilters } from "../types";
import {
  adminErrorMessage,
  formatDateTime,
  ROLE_LABEL,
  USER_STATUS_LABEL,
  userStatusVariant,
} from "../utils";
import { ConfirmDialog } from "./confirm-dialog";
import { Pagination } from "./pagination";

export const usersKey = (filters: UsersFilters) =>
  ["admin", "users", filters] as const;

/** Ação pretendida sobre um usuário (alvo + novo status). */
interface PendingAction {
  user: AdminUser;
  status: UserStatus;
}

/** Ação pretendida sobre o papel de um usuário (alvo + novo papel). */
interface PendingRole {
  user: AdminUser;
  role: UserRole;
}

const ACTION_COPY: Record<
  UserStatus,
  { label: string; title: string; variant: "default" | "destructive" }
> = {
  active: { label: "Ativar", title: "Ativar usuário?", variant: "default" },
  suspended: {
    label: "Suspender",
    title: "Suspender usuário?",
    variant: "destructive",
  },
  blocked: { label: "Bloquear", title: "Bloquear usuário?", variant: "destructive" },
};

export function UsersTable() {
  const queryClient = useQueryClient();

  // Rascunho do formulário vs. filtros aplicados.
  const [roleDraft, setRoleDraft] = useState<"" | UserRole>("");
  const [statusDraft, setStatusDraft] = useState<"" | UserStatus>("");
  const [qDraft, setQDraft] = useState("");
  const [applied, setApplied] = useState<UsersFilters>({ page: 1 });

  // Diálogo de mudança de status.
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");

  // Diálogo de mudança de papel.
  const [pendingRole, setPendingRole] = useState<PendingRole | null>(null);
  const [roleReason, setRoleReason] = useState("");
  const { user: currentUser } = useAuth();

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: usersKey(applied),
    queryFn: () => fetchUsers(applied),
  });

  const mutation = useMutation({
    mutationFn: (vars: PendingAction) =>
      updateUserStatus(vars.user.id, {
        status: vars.status,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      closeDialog();
    },
  });

  const roleMutation = useMutation({
    mutationFn: (vars: PendingRole) =>
      updateUserRole(vars.user.id, {
        role: vars.role,
        reason: roleReason.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      closeRoleDialog();
    },
  });

  // Exclusão de usuário (ex.: limpar contas de teste).
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (u: AdminUser) => deleteUser(u.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      setPendingDelete(null);
    },
  });

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplied({
      role: roleDraft || undefined,
      status: statusDraft || undefined,
      q: qDraft.trim() || undefined,
      page: 1,
    });
  }

  function clearFilters() {
    setRoleDraft("");
    setStatusDraft("");
    setQDraft("");
    setApplied({ page: 1 });
  }

  function closeDialog() {
    if (mutation.isPending) return;
    setPending(null);
    setReason("");
    mutation.reset();
  }

  function closeRoleDialog() {
    if (roleMutation.isPending) return;
    setPendingRole(null);
    setRoleReason("");
    roleMutation.reset();
  }

  const hasFilters = Boolean(applied.role || applied.status || applied.q);
  const items = data?.items ?? [];

  /** Botões de ação disponíveis para cada status atual. */
  function actionsFor(user: AdminUser): UserStatus[] {
    switch (user.status) {
      case "active":
        return ["suspended", "blocked"];
      case "suspended":
        return ["active", "blocked"];
      case "blocked":
        return ["active"];
      default:
        return [];
    }
  }

  function actionIcon(status: UserStatus) {
    if (status === "active") return ShieldCheck;
    if (status === "suspended") return ShieldBan;
    return ShieldX;
  }

  return (
    <div>
      {/* Filtros */}
      <form
        onSubmit={applyFilters}
        className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="users-q">Buscar</Label>
          <Input
            id="users-q"
            placeholder="Nome ou e-mail"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="users-role">Papel</Label>
            <Select
              id="users-role"
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value as "" | UserRole)}
              className="sm:w-40"
            >
              <SelectOption value="">Todos</SelectOption>
              <SelectOption value="customer">Contratante</SelectOption>
              <SelectOption value="professional">Profissional</SelectOption>
              <SelectOption value="admin">Admin</SelectOption>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="users-status">Status</Label>
            <Select
              id="users-status"
              value={statusDraft}
              onChange={(e) =>
                setStatusDraft(e.target.value as "" | UserStatus)
              }
              className="sm:w-40"
            >
              <SelectOption value="">Todos</SelectOption>
              <SelectOption value="active">Ativo</SelectOption>
              <SelectOption value="suspended">Suspenso</SelectOption>
              <SelectOption value="blocked">Bloqueado</SelectOption>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" aria-hidden />
            Filtrar
          </Button>
          {hasFilters && (
            <Button type="button" variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" aria-hidden />
              Limpar
            </Button>
          )}
        </div>
      </form>

      {/* Tabela */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando usuários...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {adminErrorMessage(error, "Não foi possível carregar os usuários.")}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="text-base font-medium">Nenhum usuário encontrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros e tente novamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {currentUser?.id === user.id ? (
                        <Badge variant="outline">
                          {ROLE_LABEL[user.role]} (você)
                        </Badge>
                      ) : (
                        <Select
                          aria-label="Papel do usuário"
                          value={user.role}
                          onChange={(e) => {
                            const role = e.target.value as UserRole;
                            if (role !== user.role) {
                              setRoleReason("");
                              roleMutation.reset();
                              setPendingRole({ user, role });
                            }
                          }}
                          className="w-40"
                        >
                          <SelectOption value="customer">Contratante</SelectOption>
                          <SelectOption value="professional">
                            Profissional
                          </SelectOption>
                          <SelectOption value="admin">Admin</SelectOption>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={userStatusVariant(user.status)}>
                        {USER_STATUS_LABEL[user.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {actionsFor(user).map((status) => {
                          const Icon = actionIcon(status);
                          const copy = ACTION_COPY[status];
                          return (
                            <Button
                              key={status}
                              size="sm"
                              variant={
                                copy.variant === "destructive"
                                  ? "outline"
                                  : "default"
                              }
                              onClick={() => {
                                setReason("");
                                mutation.reset();
                                setPending({ user, status });
                              }}
                            >
                              <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              {copy.label}
                            </Button>
                          );
                        })}
                        {currentUser?.id !== user.id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              deleteMutation.reset();
                              setPendingDelete(user);
                            }}
                          >
                            <Trash2
                              className="mr-1.5 h-3.5 w-3.5"
                              aria-hidden
                            />
                            Excluir
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            loading={isFetching}
            onPageChange={(page) => setApplied((p) => ({ ...p, page }))}
          />
        )}
      </div>

      {/* Confirmação de mudança de status */}
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? ACTION_COPY[pending.status].title : ""}
        description={
          pending
            ? `O usuário "${pending.user.name}" terá o status alterado para "${USER_STATUS_LABEL[pending.status]}".`
            : undefined
        }
        confirmLabel={pending ? ACTION_COPY[pending.status].label : "Confirmar"}
        confirmVariant={pending ? ACTION_COPY[pending.status].variant : "default"}
        loading={mutation.isPending}
        error={
          mutation.isError
            ? adminErrorMessage(
                mutation.error,
                "Não foi possível alterar o status."
              )
            : null
        }
        onConfirm={() => pending && mutation.mutate(pending)}
        onCancel={closeDialog}
      >
        <div className="space-y-2">
          <Label htmlFor="status-reason">Motivo (opcional)</Label>
          <Textarea
            id="status-reason"
            placeholder="Descreva o motivo desta ação"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </ConfirmDialog>

      {/* Confirmação de mudança de papel */}
      <ConfirmDialog
        open={Boolean(pendingRole)}
        title="Alterar papel do usuário?"
        description={
          pendingRole
            ? `"${pendingRole.user.name}" passará a ter o papel "${ROLE_LABEL[pendingRole.role]}".${
                pendingRole.role === "admin"
                  ? " Administradores têm acesso total ao painel."
                  : ""
              }`
            : undefined
        }
        confirmLabel="Alterar papel"
        confirmVariant={pendingRole?.role === "admin" ? "destructive" : "default"}
        loading={roleMutation.isPending}
        error={
          roleMutation.isError
            ? adminErrorMessage(
                roleMutation.error,
                "Não foi possível alterar o papel."
              )
            : null
        }
        onConfirm={() => pendingRole && roleMutation.mutate(pendingRole)}
        onCancel={closeRoleDialog}
      >
        <div className="space-y-2">
          <Label htmlFor="role-reason">Motivo (opcional)</Label>
          <Textarea
            id="role-reason"
            placeholder="Descreva o motivo desta ação"
            value={roleReason}
            onChange={(e) => setRoleReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </ConfirmDialog>

      {/* Confirmação de exclusão de usuário (limpar contas de teste etc.) */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir usuário?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" (${pendingDelete.email}) será removido da plataforma (anonimizado e desativado). Não é possível desfazer.`
            : undefined
        }
        confirmLabel="Excluir"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
        error={
          deleteMutation.isError
            ? adminErrorMessage(
                deleteMutation.error,
                "Não foi possível excluir o usuário."
              )
            : null
        }
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        onCancel={() => {
          if (!deleteMutation.isPending) setPendingDelete(null);
        }}
      />
    </div>
  );
}
