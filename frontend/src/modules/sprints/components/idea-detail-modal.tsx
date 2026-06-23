"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Paperclip, Pin, ThumbsUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  baixarIdea,
  comentarIdea,
  deleteAnexo,
  deleteIdea,
  fetchIdea,
  reabrirIdea,
  updateIdea,
  uploadAnexo,
  votarIdea,
} from "../api";
import {
  dataBR,
  STATUS_IDEA_LABEL,
  TIPO_META,
  tipoEventoLabel,
  URGENCIA_META,
} from "../helpers";
import type { Sprint, StatusIdea, TipoIdeia, Urgencia } from "../types";
import { ModalShell } from "./modal-shell";

interface Props {
  ideaId: string;
  sprints: Sprint[];
  onClose: () => void;
  onChanged: () => void;
}

interface FormState {
  titulo: string;
  descricao: string;
  tipo: TipoIdeia;
  urgencia: Urgencia;
  status: StatusIdea;
  sprint_id: string;
  responsavel_username: string;
}

export function IdeaDetailModal({ ideaId, sprints, onClose, onChanged }: Props) {
  const { data: idea, isLoading, refetch } = useQuery({
    queryKey: ["sprint-idea", ideaId],
    queryFn: () => fetchIdea(ideaId),
  });
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [novoComentario, setNovoComentario] = useState("");
  const [confirmDel, setConfirmDel] = useState<{
    vinculos: string[];
    recomendacao: string | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (idea) {
      setForm({
        titulo: idea.titulo,
        descricao: idea.descricao ?? "",
        tipo: idea.tipo,
        urgencia: idea.urgencia,
        status: idea.status,
        sprint_id: idea.sprint_id ?? "",
        responsavel_username: idea.responsavel_username ?? "",
      });
    }
  }, [idea]);

  async function refresh() {
    await refetch();
    onChanged();
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function salvar() {
    if (!form) return;
    await run(() =>
      updateIdea(ideaId, {
        titulo: form.titulo,
        descricao: form.descricao || null,
        tipo: form.tipo,
        urgencia: form.urgencia,
        status: form.status,
        sprint_id: form.sprint_id || null,
        responsavel_username: form.responsavel_username || null,
      })
    );
  }

  async function excluir() {
    const r = await deleteIdea(ideaId, false);
    if (r.excluida) {
      onChanged();
      onClose();
      return;
    }
    setConfirmDel({ vinculos: r.vinculos, recomendacao: r.recomendacao });
  }

  async function confirmarExclusao() {
    await deleteIdea(ideaId, true);
    onChanged();
    onClose();
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void run(() => uploadAnexo(ideaId, file));
    e.target.value = "";
  }

  if (isLoading || !idea || !form) {
    return (
      <ModalShell title={<span className="text-sm">Carregando...</span>} onClose={onClose}>
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </ModalShell>
    );
  }

  const urg = URGENCIA_META[idea.urgencia];
  const concluida = idea.status === "feita" || idea.status === "arquivada";

  const header = (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", urg.cls)}>
          {urg.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {TIPO_META[idea.tipo].label} · {STATUS_IDEA_LABEL[idea.status]} · score{" "}
          <span className="font-bold text-brand">{idea.score}</span>
        </span>
      </div>
      <h2 className="truncate text-base font-bold text-foreground">{idea.titulo}</h2>
    </div>
  );

  return (
    <ModalShell title={header} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Edição */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="id-titulo">Título</Label>
            <Input
              id="id-titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="id-desc">Descrição</Label>
            <textarea
              id="id-desc"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="id-tipo">Tipo</Label>
              <Select
                id="id-tipo"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoIdeia })}
              >
                {(Object.keys(TIPO_META) as TipoIdeia[]).map((t) => (
                  <SelectOption key={t} value={t}>
                    {TIPO_META[t].label}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-urg">Urgência</Label>
              <Select
                id="id-urg"
                value={form.urgencia}
                onChange={(e) =>
                  setForm({ ...form, urgencia: e.target.value as Urgencia })
                }
              >
                {(Object.keys(URGENCIA_META) as Urgencia[]).map((u) => (
                  <SelectOption key={u} value={u}>
                    {URGENCIA_META[u].label}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-status">Status</Label>
              <Select
                id="id-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as StatusIdea })
                }
              >
                {(Object.keys(STATUS_IDEA_LABEL) as StatusIdea[]).map((s) => (
                  <SelectOption key={s} value={s}>
                    {STATUS_IDEA_LABEL[s]}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-sprint">Sprint</Label>
              <Select
                id="id-sprint"
                value={form.sprint_id}
                onChange={(e) => setForm({ ...form, sprint_id: e.target.value })}
              >
                <SelectOption value="">Sem sprint</SelectOption>
                {sprints.map((s) => (
                  <SelectOption key={s.id} value={s.id}>
                    {s.nome}
                  </SelectOption>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="id-resp">Responsável</Label>
            <Input
              id="id-resp"
              value={form.responsavel_username}
              onChange={(e) =>
                setForm({ ...form, responsavel_username: e.target.value })
              }
              placeholder="e-mail do responsável"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void salvar()} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Salvar
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void run(() => votarIdea(ideaId))}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden />
            {idea.votado_por_mim ? "Remover voto" : "Votar"} ({idea.votos_count})
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() => (concluida ? reabrirIdea(ideaId) : baixarIdea(ideaId)))
            }
          >
            {concluida ? "Reabrir" : "Dar baixa"}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() =>
              void run(() => updateIdea(ideaId, { fixado_topo: !idea.fixado_topo }))
            }
          >
            <Pin className="h-4 w-4" aria-hidden />
            {idea.fixado_topo ? "Desafixar" : "Fixar"}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={busy}
            onClick={() => void excluir()}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Excluir
          </Button>
        </div>

        {/* Anexos */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Anexos</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" aria-hidden />
              Anexar
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
          {idea.anexos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {idea.anexos.map((a) => (
                <div key={a.id} className="rounded-lg border bg-card p-2">
                  {a.tipo === "imagem" && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.filename}
                      className="h-20 w-20 rounded object-cover"
                    />
                  ) : (
                    <a
                      href={a.url ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      {a.filename}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void run(() => deleteAnexo(a.id))}
                    className="mt-1 block text-[11px] text-destructive hover:underline"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Comentários */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Comentários</h3>
          {idea.comentarios.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {c.autor_nome ?? c.autor_username} · {dataBR(c.created_at)}
              </p>
              <p className="whitespace-pre-wrap">{c.texto}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Escreva um comentário"
            />
            <Button
              variant="outline"
              disabled={busy || !novoComentario.trim()}
              onClick={() =>
                void run(async () => {
                  await comentarIdea(ideaId, novoComentario.trim());
                  setNovoComentario("");
                })
              }
            >
              Enviar
            </Button>
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Histórico</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {idea.eventos.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-1">
                <span className="font-medium text-foreground">
                  {tipoEventoLabel(e.tipo_evento)}
                </span>
                {e.descricao ? <span>· {e.descricao}</span> : null}
                <span>— {dataBR(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {confirmDel ? (
        <ConfirmDialog
          open
          title="Excluir esta ideia?"
          description={
            <>
              {confirmDel.recomendacao ?? "Esta ação não pode ser desfeita."}
              {confirmDel.vinculos.length > 0 ? (
                <span className="mt-1 block font-semibold">
                  Vínculos: {confirmDel.vinculos.join(", ")}
                </span>
              ) : null}
            </>
          }
          confirmLabel="Excluir tudo"
          onConfirm={() => void confirmarExclusao()}
          onCancel={() => setConfirmDel(null)}
        />
      ) : null}
    </ModalShell>
  );
}
