/** Camada de API do módulo admin Sprints (prefixo /admin/sprints). */

import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/services/api";

import type {
  Anexo,
  Comentario,
  Idea,
  IdeaDetail,
  IdeaFilters,
  Kpis,
  SmartDeleteResult,
  Sprint,
  VotoResult,
} from "./types";

const BASE = "/admin/sprints";

export const fetchKpis = () => apiGet<Kpis>(`${BASE}/kpis`);

export function fetchIdeas(filters: IdeaFilters): Promise<{ items: Idea[] }> {
  const p = new URLSearchParams({ aba: filters.aba });
  if (filters.tipo) p.set("tipo", filters.tipo);
  if (filters.urgencia) p.set("urgencia", filters.urgencia);
  if (filters.autor) p.set("autor", filters.autor);
  if (filters.sprint_id) p.set("sprint_id", filters.sprint_id);
  if (filters.busca) p.set("busca", filters.busca);
  if (filters.origem) p.set("origem", filters.origem);
  return apiGet<{ items: Idea[] }>(`${BASE}/ideas?${p.toString()}`);
}

export const fetchIdea = (id: string) =>
  apiGet<IdeaDetail>(`${BASE}/ideas/${id}`);

export const createIdea = (body: Partial<Idea>) =>
  apiPost<IdeaDetail>(`${BASE}/ideas`, body);

export const updateIdea = (id: string, body: Partial<Idea>) =>
  apiPut<IdeaDetail>(`${BASE}/ideas/${id}`, body);

export const baixarIdea = (id: string) =>
  apiPost<IdeaDetail>(`${BASE}/ideas/${id}/baixar`, {});

export const reabrirIdea = (id: string) =>
  apiPost<IdeaDetail>(`${BASE}/ideas/${id}/reabrir`, {});

export const votarIdea = (id: string) =>
  apiPost<VotoResult>(`${BASE}/ideas/${id}/votar`, {});

export const comentarIdea = (id: string, texto: string) =>
  apiPost<Comentario>(`${BASE}/ideas/${id}/comentarios`, { texto });

export const deleteIdea = (id: string, confirmar: boolean) =>
  apiDelete<SmartDeleteResult>(`${BASE}/ideas/${id}?confirmar=${confirmar}`);

export function uploadAnexo(id: string, file: File): Promise<Anexo> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<Anexo>(`${BASE}/ideas/${id}/anexos`, form);
}

export const deleteAnexo = (id: string) =>
  apiDelete<{ ok: boolean }>(`${BASE}/anexos/${id}`);

export const fetchSprints = () => apiGet<Sprint[]>(`${BASE}/sprints`);

export const createSprint = (body: Partial<Sprint>) =>
  apiPost<Sprint>(`${BASE}/sprints`, body);

export const updateSprint = (id: string, body: Partial<Sprint>) =>
  apiPut<Sprint>(`${BASE}/sprints/${id}`, body);

export const deleteSprint = (id: string) =>
  apiDelete<{ ok: boolean }>(`${BASE}/sprints/${id}`);
