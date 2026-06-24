"use client";

/**
 * Painel admin — **Sprints / Esteira de Ideias** (`/admin/sprints`).
 *
 * Gestão de produto (bugs/melhorias/consertos/ideias). Só admin. 4 KPIs, 3 abas
 * (Esteira ativa | Quadro de sprints | Histórico), toolbar de filtros e os 3
 * modais. Tokens de tema (dark-mode ok).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Plus, Rocket, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  dataBR,
  deleteSprint,
  fetchIdeas,
  fetchKpis,
  fetchSprints,
  IdeaDetailModal,
  IdeaRow,
  NovaIdeiaModal,
  SprintModal,
  STATUS_SPRINT_LABEL,
  TIPO_META,
  URGENCIA_META,
} from "@/modules/sprints";
import type { Sprint, TipoIdeia, Urgencia } from "@/modules/sprints";

type Aba = "ativa" | "quadro" | "historico";

export default function AdminSprintsPage() {
  const auth = useRequireAuth("admin");
  const qc = useQueryClient();

  const [aba, setAba] = useState<Aba>("ativa");
  const [tipo, setTipo] = useState<TipoIdeia | "">("");
  const [urgencia, setUrgencia] = useState<Urgencia | "">("");
  const [autor, setAutor] = useState("");
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState<"" | "admin" | "usuario">("");

  const [novaIdeia, setNovaIdeia] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sprintModal, setSprintModal] = useState<{ sprint: Sprint | null } | null>(
    null
  );
  const [sprintDel, setSprintDel] = useState<Sprint | null>(null);

  const abaApi = aba === "historico" ? "historico" : "ativa";

  const kpis = useQuery({ queryKey: ["sprint-kpis"], queryFn: fetchKpis });
  const ideas = useQuery({
    queryKey: ["sprint-ideas", abaApi, tipo, urgencia, autor, busca, origem],
    queryFn: () =>
      fetchIdeas({
        aba: abaApi,
        tipo: tipo || undefined,
        urgencia: urgencia || undefined,
        autor: autor || undefined,
        busca: busca || undefined,
        origem: origem || undefined,
      }),
    enabled: aba !== "quadro",
  });
  const sprints = useQuery({ queryKey: ["sprints"], queryFn: fetchSprints });

  const autores = useMemo(() => {
    const set = new Map<string, string>();
    for (const i of ideas.data?.items ?? []) {
      set.set(i.autor_username, i.autor_nome ?? i.autor_username);
    }
    return [...set.entries()];
  }, [ideas.data]);

  function refreshAll() {
    void qc.invalidateQueries({ queryKey: ["sprint-ideas"] });
    void qc.invalidateQueries({ queryKey: ["sprint-kpis"] });
    void qc.invalidateQueries({ queryKey: ["sprints"] });
  }

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const kpiCards = [
    { label: "Abertas", value: kpis.data?.abertas },
    { label: "Críticas", value: kpis.data?.criticas },
    { label: "Em sprint", value: kpis.data?.em_sprint },
    { label: "Feitas no mês", value: kpis.data?.feitas_no_mes },
  ];

  const TABS: { id: Aba; label: string }[] = [
    { id: "ativa", label: "Esteira ativa" },
    { id: "quadro", label: "Quadro de sprints" },
    { id: "historico", label: "Histórico" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Painel
      </Link>

      <header className="mb-6 mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-6 w-6 text-brand" aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight">Sprints</h1>
        </div>
        <Button className="gap-1.5" onClick={() => setNovaIdeia(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova ideia
        </Button>
      </header>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{k.value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id)}
            className={
              aba === t.id
                ? "border-b-2 border-brand px-3 py-2 text-sm font-semibold text-foreground"
                : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === "quadro" ? (
        <QuadroSprints
          sprints={sprints.data ?? []}
          onNew={() => setSprintModal({ sprint: null })}
          onEdit={(s) => setSprintModal({ sprint: s })}
          onDelete={(s) => setSprintDel(s)}
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoIdeia | "")}>
              <SelectOption value="">Todos os tipos</SelectOption>
              {(Object.keys(TIPO_META) as TipoIdeia[]).map((t) => (
                <SelectOption key={t} value={t}>
                  {TIPO_META[t].label}
                </SelectOption>
              ))}
            </Select>
            <Select
              value={urgencia}
              onChange={(e) => setUrgencia(e.target.value as Urgencia | "")}
            >
              <SelectOption value="">Todas as urgências</SelectOption>
              {(Object.keys(URGENCIA_META) as Urgencia[]).map((u) => (
                <SelectOption key={u} value={u}>
                  {URGENCIA_META[u].label}
                </SelectOption>
              ))}
            </Select>
            <Select value={autor} onChange={(e) => setAutor(e.target.value)}>
              <SelectOption value="">Todos os autores</SelectOption>
              {autores.map(([username, nome]) => (
                <SelectOption key={username} value={username}>
                  {nome}
                </SelectOption>
              ))}
            </Select>
            <Select
              value={origem}
              onChange={(e) =>
                setOrigem(e.target.value as "" | "admin" | "usuario")
              }
            >
              <SelectOption value="">Todas as origens</SelectOption>
              <SelectOption value="usuario">Reportado por usuário</SelectOption>
              <SelectOption value="admin">Criado no painel</SelectOption>
            </Select>
          </div>

          {/* Lista */}
          {ideas.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : (ideas.data?.items.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhuma ideia aqui.
            </div>
          ) : (
            <div className="space-y-2">
              {ideas.data?.items.map((idea) => (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  onClick={() => setDetailId(idea.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {novaIdeia ? (
        <NovaIdeiaModal
          sprints={sprints.data ?? []}
          onClose={() => setNovaIdeia(false)}
          onCreated={refreshAll}
        />
      ) : null}
      {detailId ? (
        <IdeaDetailModal
          ideaId={detailId}
          sprints={sprints.data ?? []}
          onClose={() => setDetailId(null)}
          onChanged={refreshAll}
        />
      ) : null}
      {sprintModal ? (
        <SprintModal
          sprint={sprintModal.sprint}
          onClose={() => setSprintModal(null)}
          onSaved={refreshAll}
        />
      ) : null}
      <ConfirmDialog
        open={sprintDel !== null}
        title="Excluir sprint?"
        description="As ideias vinculadas ficam sem sprint (não são apagadas)."
        confirmLabel="Excluir sprint"
        onConfirm={() => {
          if (sprintDel) {
            void deleteSprint(sprintDel.id).then(() => {
              setSprintDel(null);
              refreshAll();
            });
          }
        }}
        onCancel={() => setSprintDel(null)}
      />
    </main>
  );
}

function QuadroSprints({
  sprints,
  onNew,
  onEdit,
  onDelete,
}: {
  sprints: Sprint[];
  onNew: () => void;
  onEdit: (s: Sprint) => void;
  onDelete: (s: Sprint) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" className="gap-1.5" onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova sprint
        </Button>
      </div>
      {sprints.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma sprint criada.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sprints.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground">{s.nome}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {STATUS_SPRINT_LABEL[s.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {dataBR(s.data_inicio)} — {dataBR(s.data_fim)}
              </p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {s.ideias_feitas}/{s.total_ideias} feitas
                  </span>
                  <span>{s.progresso}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-brand"
                    style={{ width: `${s.progresso}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onEdit(s)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(s)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
