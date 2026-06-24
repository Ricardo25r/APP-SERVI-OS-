/** Tipos do módulo admin Sprints / Esteira de Ideias (espelham o backend). */

export type TipoIdeia = "bug" | "melhoria" | "conserto" | "ideia";
export type Urgencia = "critica" | "alta" | "media" | "baixa";
export type StatusIdea = "aberta" | "em_andamento" | "feita" | "arquivada";
export type StatusSprint = "planejado" | "ativo" | "encerrado";

export interface Idea {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoIdeia;
  urgencia: Urgencia;
  status: StatusIdea;
  sprint_id: string | null;
  autor_username: string;
  autor_nome: string | null;
  responsavel_username: string | null;
  fixado_topo: boolean;
  votos_count: number;
  created_at: string;
  updated_at: string;
  feito_em: string | null;
  feito_por_username: string | null;
  score: number;
  anexos_count: number;
  comentarios_count: number;
  sprint_nome: string | null;
  origem: "admin" | "usuario";
}

export interface Anexo {
  id: string;
  tipo: string | null;
  filename: string;
  mime: string | null;
  tamanho_bytes: number | null;
  enviado_por_username: string | null;
  created_at: string;
  url: string | null;
}

export interface Comentario {
  id: string;
  autor_username: string;
  autor_nome: string | null;
  texto: string;
  created_at: string;
}

export interface Evento {
  id: string;
  tipo_evento: string;
  descricao: string | null;
  autor_username: string | null;
  created_at: string;
}

export interface IdeaDetail extends Idea {
  anexos: Anexo[];
  comentarios: Comentario[];
  eventos: Evento[];
  votado_por_mim: boolean;
}

export interface Sprint {
  id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: StatusSprint;
  created_at: string;
  updated_at: string;
  total_ideias: number;
  ideias_feitas: number;
  progresso: number;
}

export interface Kpis {
  abertas: number;
  criticas: number;
  em_sprint: number;
  feitas_no_mes: number;
}

export interface SmartDeleteResult {
  pode_excluir: boolean;
  vinculos: string[];
  recomendacao: string | null;
  excluida: boolean;
}

export interface VotoResult {
  votou: boolean;
  votos_count: number;
}

export interface IdeaFilters {
  aba: "ativa" | "historico";
  tipo?: TipoIdeia | "";
  urgencia?: Urgencia | "";
  autor?: string;
  sprint_id?: string;
  busca?: string;
  origem?: "admin" | "usuario" | "";
}
