# search-engine.md

# Search Engine

Projeto: TrampoJá

Versão: 1.0

Status: Documento Oficial

---

# 1. Objetivo

O **Search Engine** é o módulo responsável pela **busca ativa** na plataforma TrampoJá.

Enquanto o **Matching Engine** (`06-matching-engine`) executa a **distribuição passiva** de leads — o sistema empurra um lead para os profissionais mais compatíveis —, o Search Engine faz o caminho inverso: permite que **usuários encontrem ativamente** profissionais e categorias por meio de consulta textual, filtros e ordenação.

São dois fluxos complementares e distintos:

| Aspecto | Matching Engine (06) | Search Engine (este documento) |
|---|---|---|
| Direção | Sistema → Profissional (push) | Usuário → Resultados (pull) |
| Gatilho | Criação de lead | Consulta do usuário |
| Resultado | Fila de profissionais que recebem o lead | Lista paginada de profissionais/categorias |
| Custo | Profissional gasta créditos ao comprar lead | Busca é gratuita; não consome créditos |
| Pontuação | Matching Score (fórmula proprietária do 06) | Relevância de busca (reaproveita critérios, não duplica a fórmula) |

Objetivos específicos:

* Permitir busca de profissionais por nome, categoria e cidade.
* Permitir busca e navegação por categorias.
* Oferecer filtros ricos (categoria, localidade, verificado, premium, disponibilidade, faixa de avaliação).
* Ordenar resultados por relevância, avaliação, proximidade e atividade.
* Garantir desempenho com índices PostgreSQL e cache Redis no MVP.
* Preparar evolução para busca textual avançada e geolocalização.

---

# 2. Escopo

## 2.1 Dentro do Escopo

* Busca de **profissionais** (entidade `professional_profiles` + `users` + `professional_categories`).
* Busca de **categorias** (entidade `categories`).
* Filtros sobre os campos já existentes no schema oficial (`04-banco-de-dados`).
* Ordenação e relevância dos resultados.
* Cache de resultados e de dados de apoio em Redis.
* Estratégia de indexação (índices PostgreSQL no MVP; full-text PostgreSQL; ElasticSearch como evolução futura).
* Endpoints REST de leitura, paginação e parâmetros de consulta.

## 2.2 Fora do Escopo (pertence a outros documentos)

* Distribuição de leads e cálculo do Matching Score → `06-matching-engine`.
* Cálculo do `reputation_score` e dos selos → `07-reputation-engine`.
* Cálculo de XP, níveis e medalhas → `08-gamification-engine`.
* Compra de leads, créditos e premium → `02-lead-engine`, `05-payment-engine`.
* Verificação de documentos / aprovação de selo verificado → `05-payment-engine`.
* Regras de antifraude → **anti-fraud-engine.md (docs/19 — dependência disponível, integração a detalhar na implementação)**.

## 2.3 Atores

* **Contratante (customer)**: busca profissionais para contratar.
* **Profissional (professional)**: pode buscar categorias e outros profissionais (referência/concorrência).
* **Visitante não autenticado**: busca pública limitada (perfis e categorias), respeitando rate limiting.
* **Admin**: usa busca interna no painel administrativo (com filtros adicionais, fora do escopo público).

---

# 3. Regras de Negócio

## 3.1 Elegibilidade de um Profissional para Aparecer na Busca

Um `professional_profile` só é **indexável e exibível** na busca pública se:

* o `user` associado possui `role = professional`;
* o `user.status = active` (não `suspended`, não `blocked`);
* o `user.deleted_at` é nulo (Soft Delete — respeitar `04-banco-de-dados`);
* possui ao menos uma categoria vinculada em `professional_categories`.

> Observação: diferentemente do Matching Engine, **possuir créditos NÃO é critério** para aparecer na busca. A busca exibe presença/reputação; o gasto de créditos só ocorre na compra de lead. Profissionais com `availability_status = unavailable` **aparecem** na busca (com indicação visual de indisponibilidade), mas podem ser despriorizados na ordenação por atividade/relevância.

## 3.2 Elegibilidade de uma Categoria

Uma `category` só aparece na busca pública se `active = true`.

## 3.3 Regras de Consulta Textual

* A busca por **nome** consulta `users.name` (do profissional) e `professional_profiles.headline`.
* A busca por **categoria** consulta `categories.name` e `categories.slug`.
* A busca por **cidade** consulta `professional_profiles.city` e `professional_profiles.state`.
* Termos são normalizados: *trim*, *lowercase*, remoção de acentos (`unaccent`), colapso de espaços.
* Consultas com menos de 2 caracteres úteis não disparam busca textual (retorna sugestão/lista padrão).
* Tamanho máximo do termo: 100 caracteres (truncado/rejeitado acima disso).

## 3.4 Regras de Relevância (resumo — detalhe na seção 3.6)

* Resultados que casam em **categoria + cidade** têm prioridade sobre casamentos parciais.
* Reputação e selos **influenciam** a ordenação por relevância, **sem replicar** a fórmula do Matching (06).
* A busca **nunca** expõe dados de contato direto do profissional; o desbloqueio de contato depende de lead comprado (`02-lead-engine` / `06-matching-engine`).

## 3.5 Filtros

Filtros disponíveis na busca de profissionais, todos mapeados a campos do schema oficial:

| Filtro | Campo de origem (schema 04) | Tipo | Valores |
|---|---|---|---|
| Categoria | `professional_categories.category_id` | UUID / slug | qualquer categoria ativa |
| Cidade | `professional_profiles.city` | texto | nome de cidade |
| Estado (UF) | `professional_profiles.state` | texto | sigla de estado |
| Verificado | `professional_profiles.verified` | booleano | `true` / `false` |
| Premium | `professional_profiles.premium` | booleano | `true` / `false` |
| Disponibilidade | `professional_profiles.availability_status` | enum | `available` / `busy` / `unavailable` |
| Faixa de avaliação | `professional_profiles.rating` | decimal | `min_rating` (ex.: 4.0, 4.5) |

Regras dos filtros:

* Filtros são **combináveis** via AND lógico.
* Múltiplos valores para um mesmo filtro (ex.: várias categorias) usam OR interno.
* `min_rating` filtra `rating >= valor`. Sem valor, não filtra.
* O filtro **Premium** apenas restringe o conjunto; o **destaque** de premium em buscas (benefício previsto no `05-payment-engine`) é aplicado na ordenação, não na elegibilidade.
* Filtro de disponibilidade ausente = retorna todos os status, ordenando `available` à frente.

## 3.6 Relevância (pontuação dos resultados)

> **Importante:** a fórmula proprietária de pontuação do Matching Engine (06) **NÃO é replicada aqui**. A busca define um **Search Relevance Score** próprio, que **reaproveita os mesmos critérios de qualidade** (reputação, nível, disponibilidade, selos), mas com finalidade de **ordenação de resultados de consulta**, não de distribuição de leads.

O Search Relevance Score é composto, em ordem de prioridade, por **camadas**:

1. **Match textual / exato (peso dominante)**
   * Casamento exato de categoria solicitada: prioridade máxima.
   * Casamento de cidade/estado solicitados.
   * Casamento de nome/headline (full-text, ver seção 8).
2. **Qualidade do profissional (critérios reaproveitados de 06 e 07)**
   * `rating` (estrelas) — referência de faixas alinhada ao `06-matching-engine` (5★ > 4.5★ > 4★ > abaixo).
   * `reputation_score` e **selo** (Bronze/Prata/Ouro/Diamante) — definidos em `07-reputation-engine`.
   * `level` (1–8, Iniciante → Lenda) — definido em `08-gamification-engine`.
3. **Sinais comerciais**
   * `premium = true` recebe *boost* de destaque (benefício "Destaque em buscas" do `05-payment-engine`).
   * `verified = true` recebe leve *boost* de confiança.
4. **Atividade / disponibilidade**
   * `availability_status = available` à frente de `busy`, e `busy` à frente de `unavailable`.
   * Atividade recente (proxy: `users.last_login_at`, `xp` recente).
5. **Proximidade** (quando localidade informada)
   * MVP: igualdade de cidade/estado.
   * V2: distância geográfica real (ver seção 9).

A ponderação numérica exata dos pesos do Search Relevance Score é **parâmetro de configuração do backend** (tabela `search_ranking_weights`, ver seção 10), permitindo ajuste sem alterar código. Os valores **não podem ser manipulados pelo usuário** (regra alinhada à seção 6 e ao `06-matching-engine`).

## 3.7 Ordenação

O parâmetro `sort` aceita:

| Valor | Comportamento | Campo base |
|---|---|---|
| `relevance` (padrão) | Search Relevance Score (seção 3.6) | composto |
| `rating` | maior avaliação primeiro | `professional_profiles.rating`, desempate `total_reviews` |
| `proximity` | mais próximo primeiro | MVP: mesma cidade/estado; V2: distância real |
| `activity` | mais ativo primeiro | `users.last_login_at` desc, `xp` desc |

Empates são desfeitos sempre por: `rating` desc → `total_reviews` desc → `created_at` asc (mais antigo, por estabilidade de paginação).

## 3.8 Paginação

* Paginação por `page` + `per_page`.
* `per_page` padrão = 20, máximo = 50.
* Resposta inclui `total`, `page`, `per_page`, `total_pages`.
* Ordenação estável (com desempate por `created_at`) para evitar duplicação/salto entre páginas.
* V2 (busca textual avançada / ElasticSearch): adoção opcional de *cursor-based pagination* para grandes volumes.

---

# 4. Fluxos

## 4.1 Fluxo — Busca de Profissionais

```text
Usuário informa termo e/ou filtros
        ↓
Backend normaliza entrada (trim, lowercase, unaccent)
        ↓
Verifica cache Redis (chave = hash dos parâmetros)
        ↓
   ┌─ HIT  → retorna resultado cacheado
   └─ MISS → consulta PostgreSQL (full-text + filtros + índices)
        ↓
Aplica elegibilidade (status active, não deletado, categoria vinculada)
        ↓
Calcula Search Relevance Score (seção 3.6)
        ↓
Ordena conforme sort + desempate
        ↓
Pagina (page / per_page)
        ↓
Grava no cache Redis (TTL conforme seção 7)
        ↓
Retorna lista paginada (sem dados de contato)
```

## 4.2 Fluxo — Busca de Categorias

```text
Usuário digita termo (autocomplete) ou abre listagem
        ↓
Verifica cache Redis (lista de categorias ativas)
        ↓
   ┌─ HIT  → filtra/ordena em memória
   └─ MISS → SELECT categories WHERE active = true
        ↓
Filtra por nome/slug (unaccent, ILIKE/full-text)
        ↓
Ordena (alfabético ou por popularidade — V2)
        ↓
Retorna categorias (id, name, slug)
```

## 4.3 Fluxo — Filtragem Combinada

```text
Usuário aplica filtros (categoria + cidade + verificado + min_rating ...)
        ↓
Backend monta query parametrizada (AND entre filtros, OR intra-filtro)
        ↓
Usa índices: category_id, city, state, rating
        ↓
Aplica ordenação selecionada
        ↓
Retorna resultados + contagem total para a UI de filtros
```

## 4.4 Fluxo — Autocomplete / Sugestão

```text
Usuário digita ≥ 2 caracteres
        ↓
Consulta cache Redis de sugestões (categorias + cidades populares)
        ↓
Retorna até N sugestões (categorias, cidades, possíveis nomes)
        ↓
Debounce no frontend (evitar consulta por tecla)
```

---

# 5. Casos Especiais

* **Termo vazio + sem filtros:** retorna listagem padrão (ex.: profissionais em destaque/premium da região do usuário), nunca erro.
* **Nenhum resultado:** retorna lista vazia com `total = 0` e sugestões alternativas (categorias relacionadas, ampliar raio/estado). Nunca retorna 404 para busca sem resultado.
* **Categoria inexistente/inativa no filtro:** ignora o filtro inválido e sinaliza aviso, ou retorna vazio conforme política de API (preferência: validar e retornar 422 se o slug não existir).
* **Profissional sem categoria vinculada:** não aparece (regra 3.1).
* **Profissional suspenso/bloqueado durante a sessão:** removido dos resultados; invalidação de cache no evento de mudança de status.
* **Profissional `unavailable`:** aparece, mas marcado e despriorizado; pode ser ocultado se o filtro de disponibilidade for aplicado.
* **Cidade com grafias diferentes (acentos/caixa):** resolvida por normalização `unaccent` + `lower`.
* **Termo muito curto (< 2 chars):** não dispara full-text; retorna sugestões/listagem.
* **Termo malicioso (SQL/script):** neutralizado por query parametrizada e sanitização (seção 6).
* **Empate de score em massa:** desempate determinístico (seção 3.7) garante paginação estável.
* **Alto volume / página inexistente:** `page` além do total retorna lista vazia, não erro.
* **Profissional premium expirado:** perde *boost* assim que `premium = false` for refletido; cache invalidado.

---

# 6. Segurança

Alinhado às exigências de segurança do `03-arquitetura`:

* **Query parametrizada / ORM (SQLAlchemy):** zero concatenação de strings; previne SQL Injection.
* **Sanitização de entrada:** normalização e limite de tamanho dos termos; rejeição de payloads anômalos.
* **Rate Limiting:** limites por IP e por usuário em endpoints de busca/autocomplete (proteção contra scraping e abuso).
* **Proteção IDOR:** busca expõe apenas dados públicos de perfil; nunca IDs/dados sensíveis de contato.
* **Não exposição de contato:** telefone/e-mail do profissional nunca retornam na busca — desbloqueio só via compra de lead (`02-lead-engine`).
* **Respeito ao Soft Delete:** registros com `deleted_at` nunca aparecem.
* **RBAC:** filtros administrativos (ex.: buscar por status `suspended`) restritos a `admin`.
* **Manipulação de ranking proibida:** pesos e score calculados exclusivamente no backend; usuário não pode alterar `sort` para forçar boost indevido nem injetar parâmetros de peso (regra coerente com a seção "Segurança" do `06-matching-engine`).
* **Anti-scraping:** paginação limitada (`per_page` ≤ 50), rate limiting e detecção de padrões anômalos. Detecção avançada depende do **anti-fraud-engine.md (disponível em docs/19)**.
* **Caching seguro:** cache de busca pública não deve misturar contextos de usuários distintos quando houver dados personalizados (chaves segmentadas por contexto).

---

# 7. Auditoria

Conforme regra "Toda ação administrativa deve gerar auditoria" (`04-banco-de-dados`):

* **Buscas comuns NÃO geram `audit_logs`** (volume inviável). São registradas como **métricas/analytics** agregadas (seção 8) e, opcionalmente, em log de aplicação amostrado.
* **Geram auditoria (`audit_logs`):**
  * Alteração de pesos de ranking de busca (`search_ranking_weights`) por admin → `action = update_search_weights`.
  * Ocultação/bloqueio manual de um perfil nos resultados por admin.
  * Reindexação manual / limpeza de cache de busca disparada por admin.
* Campos reutilizados de `audit_logs`: `user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`, `created_at`.
* Ações administrativas também podem usar `admin_actions` (`admin_id`, `action`, `target_entity`, `target_id`, `reason`).
* Logs de consulta para depuração/observabilidade são mantidos fora do banco transacional (stack de logs/APM), com retenção e amostragem definidas em operação.

---

# 8. Métricas

Indicadores próprios do Search Engine (complementam as métricas de negócio do `03-arquitetura`):

* **Volume de buscas** (total, por período, por tipo: profissional vs. categoria).
* **Termos mais buscados** (top termos, top categorias, top cidades).
* **Taxa de busca sem resultado** (zero-results rate) — sinaliza lacunas de oferta por categoria/cidade.
* **CTR de resultado** (cliques em perfil / buscas) — qualidade da relevância.
* **Taxa de conversão busca → contato/lead** (busca que evolui para interesse/compra de lead).
* **Latência de busca** (p50, p95, p99) — meta MVP: p95 < 300 ms com cache, < 800 ms sem cache.
* **Cache hit rate** do Redis para busca.
* **Posição média de clique** (quão alto no ranking o usuário clica).
* **Uso de filtros** (filtros mais aplicados) e **uso de ordenação** (`sort` mais escolhido).
* **Profissionais sem exibição** (categorias/cidades com baixa oferta).

Esses dados alimentam o ajuste dos pesos de relevância e a estratégia de expansão de oferta.

---

# 9. Roadmap

| Versão | Entrega |
|---|---|
| **V1 (MVP)** | Busca por nome/categoria/cidade; filtros (categoria, cidade/estado, verificado, premium, disponibilidade, faixa de avaliação); ordenação (relevância, avaliação, proximidade por cidade, atividade); índices PostgreSQL; full-text PostgreSQL básico (`tsvector` + `unaccent`); cache Redis; paginação por página. |
| **V2** | **Geolocalização** (lat/long, busca por raio em km — alinhado ao roadmap "Geolocalização em tempo real" do `03-arquitetura` e à "área de atendimento / raio" do `06-matching-engine`); ordenação por proximidade real; cursor-based pagination; sugestões/autocomplete avançado; ranking por popularidade de categoria. |
| **V3** | **ElasticSearch / OpenSearch** como motor dedicado (relevância avançada, fuzzy/typo-tolerance, sinônimos, faceted search em escala); ranking por comportamento (alinhado ao "Matching por comportamento" do `06`). |
| **V4** | Relevância assistida por **IA** (personalização, recomendação), coerente com a visão de IA do `03-arquitetura` (V3/V4) e do `06-matching-engine`. |

### Geolocalização Futura (V2) — detalhamento

* Adição de coordenadas ao perfil (ver seção 10 — campos propostos `latitude`, `longitude`).
* Busca por **raio** (5/15/30/50 km), reaproveitando as faixas de distância já definidas no `06-matching-engine`.
* Cálculo de distância via PostGIS (extensão `earthdistance`/`postgis`) no MVP-V2, migrando para geo-search no ElasticSearch em V3.
* Ordenação `proximity` passa a usar distância real em vez de igualdade de cidade.

---

# 10. Conflitos e Observações

## 10.1 Dependências Ausentes

* **`anti-fraud-engine.md` disponível (docs/19).** Regras de anti-scraping avançado, detecção de bots/contas suspeitas em busca e bloqueio de padrões anômalos dependem desse documento, agora publicado em `docs/19-anti-fraud-engine/anti-fraud-engine.md`. Neste documento foram definidas apenas mitigações básicas (rate limiting, paginação limitada, sanitização); a integração com o anti-fraud-engine deve ser detalhada na implementação.

## 10.2 Conflitos / Lacunas com a Fonte da Verdade

1. **Geolocalização sem suporte no schema.** O `06-matching-engine` cita "raio de atuação" (15/30/50 km) e o `03-arquitetura` lista "Geolocalização em tempo real" no V2, mas `professional_profiles` (`04-banco-de-dados`) **não possui campos de latitude/longitude nem de raio**. Consequência: no MVP, "proximidade" é resolvida apenas por igualdade de `city`/`state`. A busca por raio real exige os campos propostos em 10.4 (V2).

2. **Índice de `rating` e `xp` existe, mas não há índice textual.** O `04-banco-de-dados` define índices para `city`, `state`, `category_id`, `lead status`, `rating`, `xp`, `created_at`, porém **não há índice para busca textual de nome/headline/categoria**. A busca full-text proposta requer índices GIN sobre `tsvector` (proposta em 10.4), que **estendem** — não contradizem — o schema oficial.

3. **`rating` (estrelas) vs. `reputation_score` (0–1000).** Coexistem dois indicadores de qualidade: `professional_profiles.rating` (estrelas, usado nos filtros e nas faixas do Matching) e `reputation_score` (0–1000, do `07-reputation-engine`). A busca usa **`rating` para o filtro de faixa de avaliação** (campo direto e indexado) e **`reputation_score`/selo como sinal de relevância**. Não é conflito, mas exige clareza para não duplicar semântica.

4. **Selos: `verified` (campo) vs. selos de reputação (Bronze/Prata/Ouro/Diamante).** O selo "verificado" é o campo booleano `verified` (originado no `05-payment-engine`); os selos de confiabilidade derivam do `reputation_score` (`07-reputation-engine`) e **não possuem campo persistido** no schema — são derivados em tempo de consulta. A busca trata ambos como sinais, sem criar coluna nova para os selos de reputação.

5. **"Destaque em buscas" / "Destaque Patrocinado".** O `05-payment-engine` lista "Destaque em buscas" como benefício Premium (vigente) e "Destaque Patrocinado" como receita futura. Este documento aplica o *boost* de premium na ordenação (vigente) e reserva o destaque patrocinado para alinhamento futuro com o Payment Engine, **sem implementá-lo no MVP**.

6. **Idiomas/enum em PT vs. EN.** O schema oficial (`04`) usa valores em inglês (`open`, `available`, `one_time`); textos descritivos de outros docs usam PT. Este documento adota **os valores canônicos do schema** nos contratos de API, mantendo PT apenas na descrição.

## 10.3 Decisões de Consistência Adotadas

* Endpoints REST seguem o padrão **flat** do `03-arquitetura` (ex.: `/leads`, `/credits/balance`), sem versionamento de URL no MVP.
* Nenhuma tabela existente é redefinida; todas as extensões ficam restritas à seção 10.4 ("proposta complementar").
* Pontuação de relevância é **calculada no backend** e configurável, jamais manipulável pelo cliente (coerente com `06` e `07`).

## 10.4 Modelo de Dados (proposta complementar)

> Estas estruturas **NÃO** existem no `04-banco-de-dados` e são propostas como **extensão**, sujeitas a aprovação (regra: "Nenhuma tabela deve ser criada fora desta especificação sem aprovação"). Não substituem nem contradizem o schema oficial.

### Índices propostos (PostgreSQL — full-text, MVP)

```sql
-- Extensão necessária para busca sem acento
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice full-text para nome do usuário (profissional)
CREATE INDEX idx_users_name_fts
  ON users
  USING GIN (to_tsvector('portuguese', unaccent(name)));

-- Índice full-text para headline/bio do profissional
CREATE INDEX idx_professional_profiles_text_fts
  ON professional_profiles
  USING GIN (to_tsvector('portuguese', unaccent(coalesce(headline,'') || ' ' || coalesce(bio,''))));

-- Trigram para busca aproximada de cidade e categoria
CREATE INDEX idx_professional_profiles_city_trgm
  ON professional_profiles USING GIN (lower(unaccent(city)) gin_trgm_ops);

CREATE INDEX idx_categories_name_trgm
  ON categories USING GIN (lower(unaccent(name)) gin_trgm_ops);

-- Índice composto para filtros frequentes
CREATE INDEX idx_professional_profiles_filters
  ON professional_profiles (state, city, verified, premium, availability_status, rating);
```

> Os índices de `city`, `state`, `category_id`, `rating`, `xp` já são previstos no `04-banco-de-dados`; os índices GIN/trigram acima são **adicionais**, voltados a busca textual.

### Campos propostos para Geolocalização (V2 — `professional_profiles`)

| Campo | Tipo | Descrição |
|---|---|---|
| `latitude` | `decimal(9,6)` | Latitude do ponto base do profissional (V2). |
| `longitude` | `decimal(9,6)` | Longitude do ponto base (V2). |
| `service_radius_km` | `integer` | Raio de atuação em km (reaproveita 15/30/50 do `06`). |

### Tabela proposta — `search_ranking_weights` (configuração de relevância)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK. |
| `key` | texto | Identificador do peso (ex.: `weight_rating`, `weight_premium`, `weight_verified`, `weight_level`, `weight_availability`, `weight_proximity`, `weight_text_match`). |
| `value` | decimal | Valor numérico do peso. |
| `active` | booleano | Se o peso está vigente. |
| `updated_by` | UUID | Admin que alterou (FK `users.id`). |
| `created_at` | timestamp | Criação. |
| `updated_at` | timestamp | Atualização. |

> Toda alteração nesta tabela gera registro em `audit_logs`/`admin_actions` (seção 7).

### Tabela proposta — `search_queries_log` (analytics, opcional / amostrada)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK. |
| `user_id` | UUID (nullable) | Usuário (nulo se visitante). FK `users.id`. |
| `query_text` | texto | Termo normalizado. |
| `filters` | JSONB | Filtros aplicados. |
| `sort` | texto | Ordenação usada. |
| `results_count` | integer | Nº de resultados retornados. |
| `clicked_profile_id` | UUID (nullable) | Perfil clicado, se houver. |
| `created_at` | timestamp | Momento da busca. |

> Esta tabela é **analítica**, não transacional, e não substitui `audit_logs`. Pode residir em store de analytics separado em produção.

---

# Apêndice A — Endpoints REST

Padrão consistente com `03-arquitetura` (rotas flat, FastAPI). Todos são **GET** (leitura), suportam paginação e não consomem créditos.

## A.1 Busca de Profissionais

```http
GET /search/professionals
```

**Parâmetros (query string):**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | não | Termo (nome/headline). |
| `category` | string (slug) ou UUID | não | Categoria; aceita múltiplos (`category=eletricista,encanador`). |
| `city` | string | não | Cidade. |
| `state` | string (UF) | não | Estado. |
| `verified` | boolean | não | Filtra verificados. |
| `premium` | boolean | não | Filtra premium. |
| `availability` | enum | não | `available` / `busy` / `unavailable`. |
| `min_rating` | decimal | não | Avaliação mínima (ex.: 4.5). |
| `sort` | enum | não | `relevance` (padrão) / `rating` / `proximity` / `activity`. |
| `page` | integer | não | Página (padrão 1). |
| `per_page` | integer | não | Itens por página (padrão 20, máx. 50). |
| `lat`, `lng`, `radius_km` | decimal/int | não | **V2** — busca por raio geográfico. |

**Resposta (200):**

```json
{
  "data": [
    {
      "professional_id": "uuid",
      "name": "string",
      "headline": "string",
      "city": "string",
      "state": "string",
      "verified": true,
      "premium": false,
      "rating": 4.8,
      "total_reviews": 132,
      "level": 5,
      "availability_status": "available",
      "categories": ["eletricista"],
      "relevance_score": 0.0
    }
  ],
  "total": 0,
  "page": 1,
  "per_page": 20,
  "total_pages": 0
}
```

> A resposta **nunca** inclui telefone, e-mail ou demais dados de contato (seção 6).

## A.2 Busca de Categorias

```http
GET /search/categories
```

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `q` | string | Termo (nome/slug). |
| `page` / `per_page` | integer | Paginação. |

**Resposta (200):**

```json
{
  "data": [
    { "id": "uuid", "name": "Eletricista", "slug": "eletricista" }
  ],
  "total": 0,
  "page": 1,
  "per_page": 20,
  "total_pages": 0
}
```

## A.3 Autocomplete / Sugestões

```http
GET /search/suggestions?q=ele
```

**Resposta (200):**

```json
{
  "categories": [{ "name": "Eletricista", "slug": "eletricista" }],
  "cities": ["Ariquemes"],
  "professionals": [{ "professional_id": "uuid", "name": "string" }]
}
```

---

# Apêndice B — Cache (Redis)

Alinhado ao uso de Redis previsto no `03-arquitetura`.

## B.1 O que cachear

| Chave (padrão) | Conteúdo | TTL | Invalidação |
|---|---|---|---|
| `search:prof:{hash(params)}` | Página de resultados de busca de profissionais | 60–120 s | TTL natural; eventos de mudança de perfil |
| `search:cat:all` | Lista de categorias ativas | 1 h | Ao criar/editar/desativar categoria |
| `search:suggest:{prefix}` | Sugestões/autocomplete por prefixo | 5 min | TTL natural |
| `search:weights` | Pesos de relevância (`search_ranking_weights`) | 10 min | Ao alterar pesos (admin) |
| `search:popular:cities` | Cidades mais buscadas | 1 h | Job de agregação |
| `search:popular:categories` | Categorias mais buscadas | 1 h | Job de agregação |

`hash(params)` = hash determinístico dos parâmetros normalizados (q + filtros + sort + page + per_page).

## B.2 Estratégia de TTL

* Resultados de busca: TTL curto (60–120 s) — equilíbrio entre frescor (mudanças de disponibilidade/reputação) e desempenho.
* Dados de apoio (categorias, pesos, populares): TTL maior, pois mudam pouco.

## B.3 Invalidação

* **Por evento:** mudança em `professional_profiles` (verified, premium, rating, availability_status, city/state), mudança de `users.status` (suspensão/bloqueio), criação/edição/desativação de categoria, alteração de pesos de ranking → invalida chaves relacionadas (ou usa *versioning* de namespace, ex.: `search:v{N}:...`).
* **Por TTL:** expiração natural para buscas e sugestões.
* **Manual (admin):** endpoint/ação administrativa para limpar cache de busca (gera auditoria — seção 7).

---

# Apêndice C — Indexação

## C.1 MVP — Índices PostgreSQL

* Reutiliza índices oficiais do `04-banco-de-dados`: `city`, `state`, `category_id`, `rating`, `xp`, `created_at`.
* Adiciona índices GIN/trigram para busca textual (seção 10.4).
* Filtros booleanos/enum (`verified`, `premium`, `availability_status`) cobertos por índice composto.

## C.2 Busca Textual Full-Text (PostgreSQL)

* `to_tsvector('portuguese', unaccent(...))` para nome/headline/bio.
* `unaccent` + `pg_trgm` para tolerância a acentos e busca aproximada de cidade/categoria.
* Consultas usam `@@`/`websearch_to_tsquery` para relevância textual (`ts_rank` integrado ao Search Relevance Score).

## C.3 Evolução — ElasticSearch / OpenSearch (V3)

* Motor dedicado para relevância avançada: fuzzy/typo-tolerance, sinônimos, faceted search e geo-search em escala.
* Sincronização via CDC/eventos a partir do PostgreSQL (fonte da verdade permanece o banco relacional).
* Migração transparente para os clientes: contratos REST (Apêndice A) mantidos; muda apenas a engine interna de indexação/relevância.

## C.4 Desempenho

* Metas MVP: p95 < 300 ms (cache) / < 800 ms (banco).
* `per_page` limitado a 50; ordenação estável; uso de índices em todos os filtros.
* Monitoramento contínuo via métricas (seção 8) e APM.
