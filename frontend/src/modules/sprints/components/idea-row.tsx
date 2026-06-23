"use client";

import { MessageSquare, Paperclip, Pin, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { dataBR, TIPO_META, tempoRelativo, URGENCIA_META } from "../helpers";
import type { Idea } from "../types";

export function IdeaRow({ idea, onClick }: { idea: Idea; onClick: () => void }) {
  const tipo = TIPO_META[idea.tipo];
  const urg = URGENCIA_META[idea.urgencia];
  const TipoIcon = tipo.icon;
  const concluida = idea.status === "feita" || idea.status === "arquivada";
  const tempo = idea.feito_em
    ? `feito em ${dataBR(idea.feito_em)}`
    : tempoRelativo(idea.created_at);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              urg.cls
            )}
          >
            {urg.label}
          </span>
          {idea.fixado_topo ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="Fixado" />
          ) : null}
          <span
            className={cn(
              "truncate font-bold text-foreground",
              concluida && "text-muted-foreground line-through"
            )}
          >
            {idea.titulo}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TipoIcon className="h-3.5 w-3.5" aria-hidden />
            {tipo.label}
          </span>
          <span>{idea.autor_nome ?? idea.autor_username}</span>
          <span>{tempo}</span>
          {idea.anexos_count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              {idea.anexos_count}
            </span>
          ) : null}
          {idea.comentarios_count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {idea.comentarios_count}
            </span>
          ) : null}
          {idea.votos_count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              {idea.votos_count}
            </span>
          ) : null}
          {idea.sprint_nome ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
              {idea.sprint_nome}
            </span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-extrabold text-brand">{idea.score}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          score
        </div>
      </div>
    </button>
  );
}
