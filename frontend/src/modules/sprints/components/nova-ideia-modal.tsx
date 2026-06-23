"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";

import { createIdea } from "../api";
import { TIPO_META, URGENCIA_META } from "../helpers";
import type { Sprint, TipoIdeia, Urgencia } from "../types";
import { ModalShell } from "./modal-shell";

interface Props {
  sprints: Sprint[];
  onClose: () => void;
  onCreated: () => void;
}

export function NovaIdeiaModal({ sprints, onClose, onCreated }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoIdeia>("bug");
  const [urgencia, setUrgencia] = useState<Urgencia>("media");
  const [sprintId, setSprintId] = useState("");
  const [fixado, setFixado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createIdea({
        titulo: titulo.trim(),
        descricao: descricao || null,
        tipo,
        urgencia,
        sprint_id: sprintId || null,
        fixado_topo: fixado,
      });
      onCreated();
      onClose();
    } catch {
      setError("Não foi possível criar a ideia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={<h2 className="text-base font-bold">Nova ideia</h2>} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ni-titulo">Título *</Label>
          <Input
            id="ni-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Resumo da ideia/bug"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ni-tipo">Tipo</Label>
            <Select
              id="ni-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoIdeia)}
            >
              {(Object.keys(TIPO_META) as TipoIdeia[]).map((t) => (
                <SelectOption key={t} value={t}>
                  {TIPO_META[t].label}
                </SelectOption>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ni-urg">Urgência</Label>
            <Select
              id="ni-urg"
              value={urgencia}
              onChange={(e) => setUrgencia(e.target.value as Urgencia)}
            >
              {(Object.keys(URGENCIA_META) as Urgencia[]).map((u) => (
                <SelectOption key={u} value={u}>
                  {URGENCIA_META[u].label}
                </SelectOption>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ni-desc">Descrição</Label>
          <textarea
            id="ni-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ni-sprint">Sprint</Label>
          <Select
            id="ni-sprint"
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
          >
            <SelectOption value="">Sem sprint</SelectOption>
            {sprints.map((s) => (
              <SelectOption key={s.id} value={s.id}>
                {s.nome}
              </SelectOption>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={fixado}
            onChange={(e) => setFixado(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Fixar no topo
        </label>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Criar ideia
        </Button>
      </form>
    </ModalShell>
  );
}
