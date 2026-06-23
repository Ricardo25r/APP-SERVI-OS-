"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";

import { createSprint, updateSprint } from "../api";
import { STATUS_SPRINT_LABEL } from "../helpers";
import type { Sprint, StatusSprint } from "../types";
import { ModalShell } from "./modal-shell";

interface Props {
  sprint: Sprint | null; // null = criar
  onClose: () => void;
  onSaved: () => void;
}

export function SprintModal({ sprint, onClose, onSaved }: Props) {
  const [nome, setNome] = useState(sprint?.nome ?? "");
  const [descricao, setDescricao] = useState(sprint?.descricao ?? "");
  const [inicio, setInicio] = useState(sprint?.data_inicio ?? "");
  const [fim, setFim] = useState(sprint?.data_fim ?? "");
  const [status, setStatus] = useState<StatusSprint>(sprint?.status ?? "planejado");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      nome: nome.trim(),
      descricao: descricao || null,
      data_inicio: inicio || null,
      data_fim: fim || null,
      status,
    };
    try {
      if (sprint) await updateSprint(sprint.id, body);
      else await createSprint(body);
      onSaved();
      onClose();
    } catch {
      setError("Não foi possível salvar a sprint.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={<h2 className="text-base font-bold">{sprint ? "Editar sprint" : "Nova sprint"}</h2>}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sp-nome">Nome *</Label>
          <Input id="sp-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-desc">Descrição</Label>
          <textarea
            id="sp-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sp-ini">Início</Label>
            <Input id="sp-ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-fim">Fim</Label>
            <Input id="sp-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-status">Status</Label>
          <Select
            id="sp-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusSprint)}
          >
            {(Object.keys(STATUS_SPRINT_LABEL) as StatusSprint[]).map((s) => (
              <SelectOption key={s} value={s}>
                {STATUS_SPRINT_LABEL[s]}
              </SelectOption>
            ))}
          </Select>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Salvar
        </Button>
      </form>
    </ModalShell>
  );
}
