/** Metadados visuais e formatadores do módulo Sprints (100% tokens de tema). */

import { Bug, Lightbulb, Sparkles, Wrench, type LucideIcon } from "lucide-react";

import type { StatusIdea, StatusSprint, TipoIdeia, Urgencia } from "./types";

export const TIPO_META: Record<TipoIdeia, { label: string; icon: LucideIcon }> = {
  bug: { label: "Bug", icon: Bug },
  melhoria: { label: "Melhoria", icon: Sparkles },
  conserto: { label: "Conserto", icon: Wrench },
  ideia: { label: "Ideia", icon: Lightbulb },
};

export const URGENCIA_META: Record<Urgencia, { label: string; cls: string }> = {
  critica: {
    label: "Crítica",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
  },
  alta: { label: "Alta", cls: "bg-brand/10 text-brand border-brand/30" },
  media: {
    label: "Média",
    cls: "bg-muted text-muted-foreground border-border",
  },
  baixa: { label: "Baixa", cls: "border-border text-muted-foreground" },
};

export const STATUS_IDEA_LABEL: Record<StatusIdea, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  feita: "Feita",
  arquivada: "Arquivada",
};

export const STATUS_SPRINT_LABEL: Record<StatusSprint, string> = {
  planejado: "Planejado",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

export function tempoRelativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function dataBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function tipoEventoLabel(tipo: string): string {
  const map: Record<string, string> = {
    criada: "criada",
    editada: "editada",
    status_mudou: "status alterado",
    movida_sprint: "movida de sprint",
    deu_baixa: "concluída",
    reaberta: "reaberta",
    anexou: "anexou arquivo",
    comentou: "comentou",
  };
  return map[tipo] ?? tipo;
}
