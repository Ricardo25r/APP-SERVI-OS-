# future-ai-engine.md

# Future AI Engine — Camada de Inteligência Artificial do TrampoJá

Projeto: TrampoJá

Versão: 1.0

Status: Documento Estratégico — Futuro

---

> **AVISO DE ESCOPO TEMPORAL**
>
> Este documento descreve uma camada de capacidades **FUTURAS** da plataforma TrampoJá.
> **Nada aqui pertence ao MVP** nem às fases 1–10 descritas em `01-projeto/master-task.md`.
> Cada recurso abaixo está explicitamente marcado com sua **fase de ativação (V3 → V4 → V5)**,
> em consistência com os roadmaps já existentes nos motores 06 (Matching), 07 (Reputation),
> 08 (Gamification), 05 (Payment) e 03 (Arquitetura).
>
> Este documento **consolida** a visão de IA que hoje aparece fragmentada nos roadmaps dos demais
> motores. Ele **não substitui nem contradiz** nenhum documento oficial 01–08. Onde há divergência
> ou dependência pendente, o assunto é registrado em **"## 10. Conflitos e Observações"**.
>
> **Dependência crítica ausente:** o documento `anti-fraud-engine.md` é referenciado por este motor
> (e citado em 02, 06 e 07) mas **ainda não existe** na pasta `docs/`. Os recursos de detecção de
> fraude por IA aqui descritos pressupõem esse motor como base. Ver seção 10.

---

# 1. Objetivo

O **Future AI Engine** é a camada estratégica de inteligência artificial que potencializará — sem
substituir — os motores existentes do TrampoJá. Seu objetivo central é transformar a plataforma de
um marketplace baseado em **regras determinísticas** (MVP/V1/V2) em um marketplace **adaptativo,
preditivo e assistido por IA** (V3/V4/V5).

A camada de IA existe para amplificar os objetivos de negócio já consagrados nos demais documentos:

* **aumentar a conversão** Lead → Contato e Contato → Contratação (metas em `02-lead-engine`);
* **melhorar a distribuição** de leads (evolução do `06-matching-engine`);
* **medir qualidade real** de profissionais e contratantes (evolução do `07-reputation-engine`);
* **elevar retenção e engajamento** (evolução do `08-gamification-engine`);
* **proteger a receita** detectando fraude e abuso (integração com o futuro `anti-fraud-engine`);
* **reduzir custo operacional** automatizando triagem, moderação e suporte.

Princípio reitor: **a IA recomenda e assiste; o backend decide e audita.** Nenhuma decisão de IA pode
violar as regras de segurança já estabelecidas — em particular, o usuário **nunca** pode alterar score,
ranking, reputação ou XP (regra reafirmada em 06, 07 e 08). Toda saída de IA passa por validação,
limites (guardrails) e registro de auditoria no backend.

---

# 2. Escopo

## 2.1 Dentro do escopo (FUTURO)

A camada de IA atua **exclusivamente sobre o domínio do marketplace TrampoJá** já modelado nos
documentos 01–08. Estão dentro do escopo:

1. **Assistente para contratantes** — criação e qualificação de solicitações em linguagem natural.
2. **Assistente para profissionais** — otimização de perfil, sugestão de leads, redação de respostas.
3. **Recomendação de profissionais** (para contratantes).
4. **Recomendação de leads** (para profissionais).
5. **Previsão de conversão** — probabilidade de um lead converter.
6. **Score de qualidade** — qualidade de leads, perfis e interações.
7. **Ranking inteligente** — evolução do matching e da reputação por IA.
8. **Detecção de fraude por IA** — integrada ao futuro `anti-fraud-engine`.
9. **Automação operacional** — triagem de denúncias, moderação assistida, suporte com IA.

## 2.2 Fora do escopo

* Criar **novos produtos** ou novas linhas de negócio fora do marketplace (ex.: e-commerce de
  materiais, cursos, crédito ao consumidor). A IA opera sobre leads, créditos, reputação, gamificação
  e monetização **já existentes**.
* Alterar a **modelagem oficial** do banco (`04-banco-de-dados`) sem aprovação. Novos campos/tabelas
  propostos por este documento estão listados em 9 e 10 como **sugestões dependentes de aprovação**.
* Substituir as **fórmulas determinísticas** de V1/V2. A IA **complementa** e, quando madura, pode
  **reponderar** essas fórmulas — sempre mantendo o cálculo final no backend e auditável.
* Decisões **autônomas irreversíveis** sem humano no circuito em ações de alto impacto (suspensão,
  bloqueio, remoção). A IA pode recomendar; a ação definitiva segue o fluxo administrativo de 03/07.

## 2.3 Camadas técnicas afetadas

| Camada | Documento de origem | Papel da IA (futuro) |
|---|---|---|
| Lead Engine | `02-lead-engine` | classificação, previsão de conversão, precificação |
| Matching Engine | `06-matching-engine` | ranking inteligente (V3), matching preditivo (V4) |
| Reputation Engine | `07-reputation-engine` | reputação baseada em IA (V3), reputação preditiva (V4) |
| Gamification Engine | `08-gamification-engine` | gamificação com IA (V5) |
| Payment Engine | `05-payment-engine` | precificação dinâmica de leads, suporte à monetização |
| Anti-Fraud Engine | `anti-fraud-engine` (ausente) | detecção de fraude por IA |
| Arquitetura | `03-arquitetura` | módulo de IA, APIs, RBAC, auditoria |

---

# 3. Regras de Negócio

As regras abaixo são **invariantes** da camada de IA e valem para todos os recursos descritos em 4.

## 3.1 Soberania do backend

* **RN-01.** Toda pontuação, ranking, reputação, XP, preço e decisão de elegibilidade é **calculada e
  persistida no backend**, nunca no cliente. (Reafirma 06 "toda pontuação calculada no backend", 07
  "toda reputação calculada exclusivamente pelo backend", 08 "toda recompensa passa por validação
  backend".)
* **RN-02.** A IA produz **sugestões, scores auxiliares e ordenações candidatas**. A decisão final é
  composta por uma função do backend que combina saída de IA + regras determinísticas + guardrails.
* **RN-03.** Nenhum usuário (contratante, profissional ou terceiro) pode alterar entradas de IA para
  manipular sua própria classificação. Inputs sensíveis (reputação, conversão, fraude) são derivados
  de eventos verificados pelo backend.

## 3.2 Complementaridade com regras determinísticas

* **RN-04.** A IA **não revoga** os filtros obrigatórios do matching: categoria, cidade, área de
  atendimento, disponibilidade, reputação mínima e saldo de créditos (06). Esses filtros são aplicados
  **antes** de qualquer reordenação por IA.
* **RN-05.** A IA **não revoga** a regra de distribuição justa do matching: a reserva de 20% dos leads
  para profissionais novos (06) é preservada como restrição (constraint) sobre a ordenação inteligente.
* **RN-06.** A IA **não cria** XP, créditos, medalhas ou reputação. Ela pode **recomendar** missões,
  metas ou bônus, mas a concessão segue as regras de 08 e a validação anti-abuso.

## 3.3 Transparência e controle do usuário

* **RN-07.** Conteúdo gerado por IA exibido ao usuário (texto de solicitação, resposta sugerida,
  descrição de perfil) deve ser **editável e aprovável** pelo usuário antes de ser publicado.
* **RN-08.** Recomendações devem ser **explicáveis** em linguagem simples ("este profissional aparece
  porque está a 3 km, tem nota 4,9 e responde em menos de 5 minutos"), reaproveitando os mesmos
  fatores das fórmulas de 06/07.
* **RN-09.** O usuário pode **recusar** o uso do assistente; a plataforma deve permanecer plenamente
  funcional sem IA (degradação graciosa para as regras de V1/V2).

## 3.4 Limites operacionais (guardrails)

* **RN-10.** Ações de IA respeitam os **mesmos limites antispam** do sistema atual: máximo de 20
  notificações/dia por profissional (06). A IA **otimiza** quais leads notificar dentro desse teto, não
  o expande.
* **RN-11.** A IA **não envia leads** para usuários bloqueados, suspensos, inadimplentes ou com contas
  suspeitas (lista de exclusões de 06).
* **RN-12.** Saídas de IA com baixa confiança caem em **fallback determinístico** (regras V1/V2) e,
  quando aplicável, em **revisão humana**.

## 3.5 Provedor de IA

* **RN-13.** O provedor padrão de LLM/assistente é a **Anthropic (modelos Claude)**, usando os modelos
  mais recentes disponíveis. Recomendação de modelos para 2026:
  * **`claude-opus-4-8`** — raciocínio complexo, qualificação rica de solicitações, redação assistida,
    moderação com nuance, agentes de suporte de alto valor.
  * **`claude-sonnet-4-6`** — workloads de alto volume e equilíbrio custo/qualidade (classificação,
    sumarização, geração padrão de texto).
  * **`claude-haiku-4-5`** — tarefas simples e sensíveis a latência/custo (classificação binária,
    rotulagem rápida, pré-triagem).
* **RN-14.** A **arquitetura deve ser agnóstica de provedor**: o acesso ao LLM é feito por uma
  abstração (`LLMProvider`/gateway de IA) que permite trocar Claude por outro provedor sem reescrever
  a lógica de negócio. Chave de API, modelo e parâmetros são **configuráveis** por ambiente.

---

# 4. Fluxos e Recursos (Conteúdo Específico)

Cada recurso abaixo descreve: **objetivo · entradas/saídas · abordagem (regras → ML → LLM) · fase**.
A abordagem é sempre **faseada e incremental**: começa com regras determinísticas (já existentes),
evolui para Machine Learning (ML) clássico e, por fim, incorpora LLM (Claude) onde há ganho real.

---

## 4.1 Assistente para Contratantes (criar/qualificar solicitações em linguagem natural)

**Fase:** V3 (assistência) → V4 (qualificação preditiva).
**Origem nos roadmaps:** `03-arquitetura` V3 — "IA para criação automática de solicitações".

**Objetivo.** Permitir que o contratante descreva sua necessidade em texto livre (ex.: *"meu chuveiro
não esquenta e o disjuntor cai quando ligo"*) e a plataforma gere uma **solicitação estruturada e bem
qualificada**, aumentando a qualidade do lead na origem.

**Entradas:**
* texto livre do contratante (chat/voz transcrita);
* localização (cidade, estado, bairro) — campos já em `leads` (04);
* histórico do contratante (solicitações anteriores, reputação).

**Saídas (proposta, sempre editável — RN-07):**
* `category_id` sugerida (mapeada para `categories`);
* `title` e `description` reescritos e claros;
* `lead_type` sugerido (`one_time` / `temporary` / `permanent`);
* `urgency` sugerida (`immediate` / `today` / `this_week` / `flexible`);
* perguntas de qualificação faltantes ("Você precisa hoje ou pode ser nesta semana?");
* classificação preliminar de valor (Simples/Médio/Premium — 02), que influencia `credits_cost`.

**Abordagem:**
1. **Regras (base, já existente):** formulário guiado + taxonomia de categorias (04). O assistente
   apenas **pré-preenche** o formulário oficial; nada some.
2. **ML:** classificador de categoria e de urgência treinado em leads históricos rotulados; extração de
   entidades (local, prazo, escopo).
3. **LLM (Claude):** `claude-opus-4-8` para interpretar texto livre, normalizar a descrição, gerar
   perguntas de qualificação e propor `lead_type`/`urgency`. Saída estruturada (JSON) validada por
   schema antes de virar registro em `leads`.

**Guardrails:** a solicitação final só é criada após **confirmação do contratante**. A IA não publica
leads automaticamente nem altera `credits_cost` sem passar pela regra oficial de classificação (02/05).

---

## 4.2 Assistente para Profissionais (otimizar perfil, sugerir leads, redigir respostas)

**Fase:** V3 (assistência) → V4 (recomendação preditiva).
**Origem nos roadmaps:** consolidação de `03-arquitetura` V3/V4 e do Lead Engine (02).

**Objetivo.** Ajudar o profissional a **construir carreira na plataforma** (filosofia de 02 e 08):
melhorar o perfil, priorizar quais leads comprar e responder mais rápido e melhor.

### 4.2.1 Otimização de perfil
* **Entradas:** `professional_profiles` (headline, bio, categorias, rating, nível, XP), benchmarks da
  categoria/cidade, lacunas de verificação.
* **Saídas:** sugestões de `headline`/`bio`, recomendação de completar cadastro (gera XP em 02/08),
  recomendação de verificação/premium (05), estimativa de impacto no matching (06).
* **Abordagem:** Regras (checklist de completude → XP de 02/08) → ML (correlação entre atributos de
  perfil e conversão) → LLM (`claude-sonnet-4-6`) para redigir headline/bio em PT-BR, sempre editável.

### 4.2.2 Sugestão de leads (priorização)
* **Entradas:** leads elegíveis (após filtros de 06), saldo de créditos, histórico de conversão do
  profissional, score de qualidade do lead (4.6), previsão de conversão (4.5).
* **Saídas:** lista ordenada "leads que valem seus créditos", com justificativa (RN-08).
* **Abordagem:** Regras (matching score de 06) → ML (ranking de aderência profissional×lead) → LLM
  para explicação textual. **Não** compra leads automaticamente; respeita teto de notificações (RN-10).

### 4.2.3 Redação de respostas
* **Entradas:** contexto do lead, mensagens da conversa (`conversations`/`messages` — 04), tom desejado.
* **Saídas:** rascunho de mensagem de resposta ao contratante, sugestões de follow-up.
* **Abordagem:** LLM (`claude-sonnet-4-6`) com rascunho **sempre revisável** pelo profissional (RN-07).
  Auxilia o profissional a bater a meta de "Resposta Rápida" (medalha de 02/08) sem fabricar tempo de
  resposta (a métrica continua medida pelo backend).

---

## 4.3 Recomendação de Profissionais (para contratantes)

**Fase:** V3.
**Origem nos roadmaps:** `03-arquitetura` V3 — "IA para recomendação de profissionais".

**Objetivo.** Quando o contratante busca ou cria uma solicitação, recomendar os profissionais mais
adequados, aumentando a percepção de "encontro rápido" (definição de sucesso de 06).

**Entradas:** solicitação/lead, profissionais elegíveis (filtros obrigatórios de 06), reputação (07),
nível/medalhas (08), distância, disponibilidade, histórico de conversão.

**Saídas:** lista ordenada de profissionais recomendados + explicação por item (RN-08).

**Abordagem:**
1. **Regras:** reaproveita o **Matching Score** de 06 (Categoria × Distância × Reputação ×
   Disponibilidade × Tempo de Resposta × Nível) como baseline.
2. **ML:** modelo de *learning-to-rank* treinado em sinais reais (taxa de resposta, taxa de compra,
   taxa de contratação — exatamente os sinais que 06 lista em "Aprendizado Futuro V3").
3. **LLM:** apenas para gerar a **explicação** e responder perguntas do contratante sobre a lista.

**Guardrails:** preserva filtros obrigatórios e exclusões de 06 (RN-04/RN-11). Não expõe contato sem
compra de lead (regra de 02). Não recomenda profissionais bloqueados/suspensos.

---

## 4.4 Recomendação de Leads (para profissionais)

**Fase:** V3.
**Relação:** é a contraparte de 4.3 e a base de 4.2.2; alimenta o ranking inteligente (4.7).

**Objetivo.** Distribuir o lead certo para o profissional certo, maximizando conversão e receita por
lead, sem concentrar oportunidades (problema central de 06).

**Entradas:** lead classificado (02), pool de profissionais elegíveis (06), previsão de conversão
(4.5), score de qualidade do lead (4.6), restrição de 20% para novos (06).

**Saídas:** ordem de distribuição/notificação do lead + prioridade.

**Abordagem:** Regras (fila Top-20 e score de 06) → ML (ranking que maximiza P(compra)×P(contratação))
→ LLM (opcional) para microcópia de notificação.

**Guardrails:** respeita teto de 20 notificações/dia (RN-10), reserva de 20% para novos (RN-05) e
exclusões (RN-11). A escassez exibida ("23 profissionais elegíveis, 2 leads restantes" — 06) continua
calculada pelo backend.

---

## 4.5 Previsão de Conversão (probabilidade de um lead converter)

**Fase:** V4.
**Origem nos roadmaps:** `06-matching-engine` V4 ("Matching preditivo") e `07-reputation-engine` V4
("Reputação preditiva"). Apoia também `05-payment-engine` (precificação).

**Objetivo.** Estimar a probabilidade de um lead **converter** em cada etapa do funil:
P(compra do lead), P(contato → contratação), P(avaliação positiva). É o motor preditivo que sustenta
4.3, 4.4, 4.7 e a precificação dinâmica.

**Entradas:**
* atributos do lead: categoria, urgência, local, `lead_type`, completude da descrição, score de
  qualidade (4.6);
* atributos do contratante: reputação (07), histórico de contratações;
* atributos do profissional candidato: reputação, nível, tempo de resposta, conversão histórica;
* sinais de contexto: horário, demanda da categoria/cidade.

**Saídas:** probabilidades calibradas (0–1) por etapa, persistidas e auditáveis.

**Abordagem:**
1. **Regras (proxy):** taxas históricas por categoria/cidade (os KPIs de 02: Lead→Contato >60%,
   Contato→Contratação >25%).
2. **ML:** modelos de classificação/regressão (ex.: gradient boosting) com calibração de probabilidade;
   monitoramento de *drift*.
3. **LLM:** **não** é o estimador primário. Pode enriquecer features extraindo sinais semânticos da
   descrição do lead (clareza, escopo, sinais de urgência real) que alimentam o modelo de ML.

**Usos:** ordenar recomendações (4.3/4.4), informar precificação de leads (05), priorizar suporte e
detectar leads frágeis (baixa P de conversão → reforço de qualificação via 4.1).

---

## 4.6 Score de Qualidade (de leads, perfis e interações)

**Fase:** V3 (lead/perfil) → V4 (interações/preditivo).

**Objetivo.** Atribuir um **score de qualidade** auxiliar a leads, perfis e conversas, separado do
`reputation_score` (07) mas que pode alimentá-lo na V3+. Reduz leads inválidos (reembolsos de 02/05) e
eleva a qualidade média da plataforma.

**Entradas/Saídas:**
* **Qualidade do lead:** completude, coerência, sinais de spam/duplicidade, telefone válido →
  `lead_quality_score`. Leads de baixa qualidade podem ser bloqueados/reclassificados antes de entrar
  na fila.
* **Qualidade do perfil:** completude, verificação, consistência → reforça sugestões de 4.2.1.
* **Qualidade da interação:** tom, tempo de resposta, resolução → sinal para reputação (07) e moderação
  (4.9).

**Abordagem:** Regras (validações de 02 — telefone, duplicidade) → ML (detecção de padrões de baixa
qualidade) → LLM (`claude-sonnet-4-6`) para avaliar **clareza e coerência semântica** do texto.

**Guardrails:** o `lead_quality_score` **não** substitui a classificação de valor (Simples/Médio/
Premium de 02) — é um sinal **adicional**. Bloqueios automáticos por baixa qualidade exigem confirmação
ou fluxo de reembolso (05) quando o lead já foi comprado.

---

## 4.7 Ranking Inteligente (evolução do matching/reputation por IA)

**Fase:** V3 (ranking por IA) → V4 (preditivo).
**Origem nos roadmaps:** `06-matching-engine` V3 "Matching por IA" / V4 "Matching preditivo";
`07-reputation-engine` V3 "Reputação baseada em IA" / V4 "Reputação preditiva";
`08-gamification-engine` ranking; `02-lead-engine` ranking (avaliações, conversão, recorrência, XP).

**Objetivo.** Unificar e evoluir, por IA, os múltiplos rankings hoje espalhados (matching de leads,
ranking de reputação, ranking de gamificação) em uma camada de **ordenação inteligente** coerente —
sem quebrar as fórmulas e pesos oficiais.

**Entradas:** todos os sinais já definidos em 06 (Matching Score), 07 (componentes da reputação e
pesos) e 08 (XP, níveis, conversão, avaliações), mais previsões de 4.5 e scores de 4.6.

**Saídas:** ordenações candidatas para (a) distribuição de leads, (b) ranking de visibilidade/busca,
(c) rankings regional/municipal/estadual/nacional (02/08).

**Abordagem:**
1. **Regras (baseline imutável):** fórmulas de 06/07/08 permanecem como **piso** e como **fallback**.
2. **ML:** *learning-to-rank* que **reponderar** os fatores existentes a partir de resultados reais
   (taxa de compra, contratação, retenção) — exatamente o "ajustar ranking automaticamente" previsto
   em 06.
3. **LLM:** somente para **explicação** e para análise qualitativa de avaliações textuais (alimenta 07).

**Guardrails:** mantém reserva de 20% para novos (RN-05), filtros e exclusões (RN-04/RN-11), e a regra
de que reputação/score nunca é editável pelo usuário (07). Reponderações por IA são **versionadas,
auditadas e reversíveis** (seção 7). As temporadas de 08 (reset a cada 90 dias) continuam válidas.

---

## 4.8 Detecção de Fraude por IA (integra com anti-fraud-engine)

**Fase:** V3 (detecção assistida) → V4 (preditiva).
**Dependência:** `anti-fraud-engine.md` (**ausente** — ver seção 10). Esta seção descreve a **camada de
IA** que se apoiará nesse motor; ela não define o motor anti-fraude em si.

**Objetivo.** Detectar, com IA, os padrões de fraude/abuso já enumerados em 02, 07 e 08:
contas duplicadas, avaliações falsas, autocontratação, compra artificial de reputação, manipulação de
ranking, abuso de bônus, XP artificial, geração automática de conquistas, golpe/assédio/ameaça.

**Entradas:**
* sinais de identidade/dispositivo: IP, dispositivo, padrão de uso (sinais já citados em 07);
* grafo de relações entre contas (contratante↔profissional), padrões de avaliação;
* sinais financeiros: chargebacks, padrões de compra de créditos (05);
* conteúdo textual de mensagens, avaliações e denúncias.

**Saídas:** `fraud_risk_score` por usuário/evento + flags categorizadas; encaminhamento para o
anti-fraud-engine e para a moderação (4.9).

**Abordagem:**
1. **Regras (base, já existentes):** detecções determinísticas de 02/07 (IP/dispositivo repetido,
   autoavaliação, avaliação duplicada).
2. **ML:** detecção de anomalias e análise de grafo (anéis de contas, conluio de avaliações).
3. **LLM:** classificação de conteúdo (golpe, assédio, ameaça, discriminação — "Reclamações Graves" de
   07) e triagem de denúncias.

**Guardrails:** a IA **sinaliza**; ações de impacto (suspensão, bloqueio, remoção, bloqueio de créditos,
estorno — 05/07) seguem o fluxo administrativo com humano no circuito. Avaliações suspeitas são
**marcadas para revisão e não contabilizadas até validação** (regra explícita de 07). Reembolso por
fraude segue a política de 02/05 (devolve créditos, não dinheiro).

---

## 4.9 Automação Operacional (triagem de denúncias, moderação assistida, suporte com IA)

**Fase:** V3 (triagem/assistência) → V4 (resolução assistida) → V5 (agentes operacionais).

**Objetivo.** Reduzir custo e tempo de resposta operacional, apoiando o **Módulo Administrativo** (03)
e a **Moderação** (denúncias, avaliações, documentos — 03).

### 4.9.1 Triagem de denúncias
* **Entradas:** `reports` (04) — motivo, descrição, alvo, histórico.
* **Saídas:** classificação de severidade, priorização da fila, ligação com sinais de fraude (4.8).
* **Abordagem:** Regras (categorias de denúncia) → ML (priorização) → LLM (`claude-opus-4-8`) para
  interpretar denúncias em texto livre e classificar reclamações graves (07).

### 4.9.2 Moderação assistida
* **Entradas:** conteúdo de perfis, mensagens, avaliações, documentos de verificação
  (`verification_requests` — 04).
* **Saídas:** recomendação de aprovar/rejeitar/escalar, com justificativa para o admin.
* **Abordagem:** LLM com prompts de política de conteúdo; **humano aprova** decisões de impacto (RN-12).
  Para verificação documental (CPF, selfie, documento — 02/05), a IA pré-analisa; a **aprovação final é
  do administrador** (regra de 05).

### 4.9.3 Suporte com IA
* **Entradas:** dúvidas de usuários, base de conhecimento da plataforma, estado da conta.
* **Saídas:** respostas de primeiro nível, resolução de casos simples (saldo, como comprar lead, como
  funciona reembolso), escalonamento para humano.
* **Abordagem:** LLM (`claude-sonnet-4-6` para volume; `claude-opus-4-8` para casos complexos) com
  recuperação de conhecimento (RAG) restrita ao domínio do TrampoJá. **Não** executa ações financeiras
  ou administrativas sensíveis sem confirmação humana.

**Guardrails gerais:** toda ação assistida por IA gera auditoria (seção 7) e respeita o RBAC de 03 —
a IA opera com o **mesmo nível de permissão** do contexto em que atua, jamais além.

---

# 5. Casos Especiais

* **CE-01. Baixa confiança / ambiguidade.** Se a confiança do modelo for inferior ao limiar
  configurado, aplica-se **fallback determinístico** (regras V1/V2) e, quando cabível, revisão humana
  (RN-12). Ex.: classificação de categoria ambígua → o assistente de 4.1 pergunta ao contratante.

* **CE-02. Indisponibilidade do provedor de IA.** Se o provedor de LLM estiver fora do ar ou exceder
  latência/orçamento, o sistema **degrada graciosamente** para regras determinísticas (RN-09). Nenhum
  fluxo crítico (criar lead, comprar lead, pagar) pode depender obrigatoriamente da IA.

* **CE-03. Profissional/contratante novo (cold start).** Sem histórico suficiente, recomendação e
  previsão usam **priors por categoria/cidade** e respeitam a reserva de 20% para novos (06). A IA não
  penaliza novatos por ausência de dados.

* **CE-04. Conflito entre IA e regra de justiça.** Se a ordenação de IA tender a concentrar leads nos
  melhores (problema central de 06), o backend **força** a restrição de 20% para novos e o balanceamento
  (RN-05). A justiça distributiva prevalece sobre a otimização de conversão.

* **CE-05. Conteúdo sensível ou ilegal.** Mensagens com golpe, assédio, ameaça ou discriminação (07)
  detectadas pela IA geram **flag imediata** e entram na fila de moderação prioritária; ação de impacto
  segue o fluxo humano.

* **CE-06. Reembolso por lead inválido detectado por IA.** Se a IA identificar telefone incorreto,
  fraude ou duplicidade após a compra, dispara o **fluxo de reembolso em créditos** de 02/05 — nunca em
  dinheiro.

* **CE-07. Edição humana sobrepõe IA.** Sempre que o usuário editar uma sugestão (texto de solicitação,
  resposta, bio), o conteúdo final é o **do usuário**. A IA registra que houve edição (sinal de
  treino/feedback).

* **CE-08. Temporada/Reset de gamificação.** A IA respeita o ciclo de temporadas de 08 (90 dias, reset
  de ranking, histórico mantido). Modelos não devem "vazar" ranking de temporada anterior como sinal
  injusto na nova temporada.

* **CE-09. Multi-tenant / regiões.** Como a plataforma é "Multi Tenant Ready" (01), modelos e limiares
  devem ser **parametrizáveis por região/cidade** (ex.: Ariquemes vs. demais), evitando viés geográfico
  indevido (ver seção 6).

---

# 6. Segurança (privacidade de dados em IA, prevenção de viés, LGPD, dados de treino)

A camada de IA herda todas as exigências de segurança de 01 e 03 (RBAC, JWT, Rate Limit, Soft Delete,
Ownership Validation, Auditoria, proteção IDOR/Mass Assignment, logs de segurança) e acrescenta
exigências específicas de IA.

## 6.1 Privacidade de dados em IA

* **SEC-01.** **Minimização de dados:** o provedor de LLM recebe apenas o **mínimo necessário** para a
  tarefa. Dados sensíveis (CPF, documento, selfie de `verification_requests`; dados financeiros de
  `payment_orders`) **não** são enviados a LLM, salvo necessidade estrita e com **redação/mascaramento**.
* **SEC-02.** **Pseudonimização:** identificadores diretos (nome, e-mail, telefone) são mascarados ou
  substituídos por tokens antes de prompts ao LLM sempre que possível.
* **SEC-03.** **Não retenção/treino pelo provedor:** os contratos/configurações com o provedor de IA
  (Claude/Anthropic ou substituto) devem garantir que dados enviados **não sejam usados para treinar
  modelos do provedor** e tenham retenção mínima. A abstração de provedor (RN-14) deve permitir auditar
  esse contrato.
* **SEC-04.** **Isolamento:** chaves de API, endpoints e logs de IA ficam em ambiente segregado, com
  acesso por RBAC; segredos nunca em código ou em prompts.

## 6.2 Prevenção de viés

* **SEC-05.** **Proteção contra viés geográfico, de gênero e de categoria:** modelos de recomendação,
  ranking e reputação devem ser auditados para não penalizar sistematicamente novatos (CE-03), regiões
  específicas (CE-09) ou perfis demográficos. Atributos sensíveis **não** entram como features diretas.
* **SEC-06.** **Fairness do marketplace:** a reserva de 20% para novos (06) e a justiça distributiva
  (CE-04) são tratadas como **restrições de fairness** obrigatórias, não como objetivos opcionais.
* **SEC-07.** **Métricas de equidade** monitoradas continuamente (seção 8): taxa de exposição por
  coorte (novos vs. veteranos, por região/categoria), disparidade de conversão.

## 6.3 LGPD (Lei Geral de Proteção de Dados)

* **SEC-08.** **Base legal e finalidade:** todo tratamento por IA tem finalidade declarada (melhorar
  matching, qualidade, prevenção de fraude). Consentimento/transparência conforme LGPD.
* **SEC-09.** **Direitos do titular:** acesso, correção, eliminação e portabilidade. O **Soft Delete**
  e o `deleted_at` de 04 devem propagar para artefatos de IA (features, embeddings, datasets de treino).
* **SEC-10.** **Decisões automatizadas:** decisões com efeito relevante (suspensão por fraude, bloqueio)
  **não** podem ser totalmente automatizadas sem direito a **revisão humana** (RN-12, CE-05) — alinhado
  ao direito de revisão de decisões automatizadas previsto na LGPD.
* **SEC-11.** **DPO/Encarregado:** registros de tratamento de IA disponíveis para o Encarregado;
  relatório de impacto (RIPD) quando o tratamento for de alto risco (ex.: detecção de fraude).

## 6.4 Dados de treino

* **SEC-12.** **Proveniência e governança:** datasets de treino são versionados, com origem rastreável
  e consentimento compatível com a finalidade.
* **SEC-13.** **Anonimização para treino:** treino com dados anonimizados/pseudonimizados sempre que
  possível; remoção de PII direta.
* **SEC-14.** **Direito ao esquecimento:** exclusão de um usuário (LGPD) implica remoção/retreino
  programado para expurgar sua contribuição de datasets, respeitando o histórico financeiro e de
  reputação que **não pode ser apagado** (04/07) — nesses casos, usa-se anonimização em vez de exclusão.
* **SEC-15.** **Prevenção de envenenamento (data poisoning) e prompt injection:** entradas de usuário
  enviadas a LLM são tratadas como **não confiáveis**; prompts de sistema isolam instruções de conteúdo
  do usuário; saídas de LLM são validadas por schema antes de qualquer efeito (RN-02).

---

# 7. Auditoria

A auditoria de IA estende `audit_logs` e `admin_actions` (04) e a auditoria financeira de 05.

* **AUD-01.** **Rastreabilidade de cada decisão de IA:** para toda saída de IA que influencie uma
  decisão (recomendação, ranking, score de qualidade, previsão, flag de fraude, ação de moderação),
  registrar: usuário/entidade afetada, tipo de tarefa, **modelo e versão** (ex.: `claude-opus-4-8`),
  versão do prompt, features/inputs (ou seu hash), saída, score de confiança, fallback aplicado,
  timestamp e (quando houver) o **humano que confirmou**.
* **AUD-02.** **Versionamento de modelos e prompts:** cada modelo de ML e cada template de prompt LLM é
  versionado; reponderações de ranking (4.7) são reversíveis (RN-12, CE-04).
* **AUD-03.** **Reversibilidade:** ações de impacto recomendadas por IA podem ser revertidas, com trilha
  completa de quem reverteu e por quê.
* **AUD-04.** **Auditoria de override humano:** toda edição/recusa de sugestão (CE-07) e todo override
  de decisão de IA por admin são registrados.
* **AUD-05.** **Auditoria de viés/fairness:** relatórios periódicos das métricas de equidade (SEC-07),
  arquivados para inspeção do Encarregado.
* **AUD-06.** **Integridade financeira preservada:** decisões de IA que tocam créditos/reembolsos (05)
  geram histórico financeiro imutável, em conformidade com "transações financeiras nunca podem ser
  apagadas" (04/05).
* **AUD-07.** **Logs nunca apagados:** trilhas de auditoria de IA seguem a regra de integridade de 04
  (Soft Delete, não remoção física).

---

# 8. Métricas

As métricas de IA **não substituem** as métricas de negócio já definidas (02, 05, 06, 07, 08); elas
medem o **impacto da IA** sobre essas métricas e a **saúde dos modelos**.

## 8.1 Impacto no negócio (reaproveita KPIs existentes)

* Conversão **Lead → Contato** (meta >60%, 02) — com vs. sem IA.
* Conversão **Contato → Contratação** (meta >25%, 02) — com vs. sem IA.
* **Taxa de compra do lead** e **tempo até compra** (06).
* **Receita por lead** e **receita por profissional** (02/05) — efeito da precificação/ranking por IA.
* **Avaliação média** (>4,5, 02/07) e **NPS** (07).
* **Retenção mensal** (>70%, 02) e frequência de uso (08).
* **Ticket médio**, **MRR/ARR**, **LTV/CAC** (05) — sensibilidade à IA.

## 8.2 Saúde e qualidade dos modelos

* **Acurácia/AUC/calibração** dos modelos de previsão de conversão (4.5) e fraude (4.8).
* **Precisão@k / recall@k** das recomendações (4.3/4.4).
* **Ganho de ranking** (uplift de conversão do ranking inteligente vs. baseline de 06/07/08).
* **Taxa de aceitação de sugestões** (assistentes 4.1/4.2) e **taxa de edição humana** (CE-07).
* **Taxa de fallback** (CE-01/CE-02) e latência média do provedor de IA.
* **Drift** de dados/modelo ao longo do tempo.

## 8.3 Operação e custo

* **Custo de IA por lead / por interação** (tokens × preço do modelo) — base para escolher
  Opus/Sonnet/Haiku por tarefa (RN-13).
* **Redução de tempo de resolução** de denúncias/suporte (4.9).
* **Falsos positivos/negativos** de fraude (4.8) e custo de revisão humana.

## 8.4 Equidade

* **Disparidade de exposição** entre novos e veteranos (deve respeitar os 20% de 06).
* **Disparidade de conversão/visibilidade** por região e categoria (CE-09, SEC-07).

---

# 9. Roadmap (faseado, V3 → V4 → V5)

Este roadmap **consolida** (não duplica) os roadmaps existentes. Ele se encaixa **após** V1 (regras) e
V2 (comportamento) já previstos em 06/07/08, e **após** as 10 fases de implementação de 01.

## V3 — IA de Assistência e Recomendação (fundação)

Alinhada a: `06` V3 (Matching por IA), `07` V3 (Reputação por IA), `03` V3 (criação de solicitações,
recomendação, ranking, precificação por IA).

* 4.1 Assistente para contratantes (criar/qualificar solicitações).
* 4.2 Assistente para profissionais (perfil, sugestão de leads, redação de respostas).
* 4.3 Recomendação de profissionais.
* 4.4 Recomendação de leads.
* 4.6 Score de qualidade (leads e perfis).
* 4.7 Ranking inteligente (reponderação por IA, com baseline 06/07/08).
* 4.8 Detecção de fraude por IA — **camada assistida** (depende do anti-fraud-engine).
* 4.9 Automação operacional — **triagem e moderação assistida**.
* Infra: gateway de IA agnóstico de provedor (RN-14), auditoria de IA (seção 7), guardrails (3.4).

## V4 — IA Preditiva (otimização)

Alinhada a: `06` V4 (Matching preditivo), `07` V4 (Reputação preditiva), `05` (precificação dinâmica).

* 4.5 Previsão de conversão (funil completo, calibrada).
* 4.7 Ranking preditivo (otimização de conversão/receita sob restrições de fairness).
* 4.6 Score de qualidade preditivo (qualidade de interações em tempo real).
* 4.8 Detecção de fraude **preditiva** (anomalias + grafo).
* Precificação dinâmica de leads (apoio a 05), respeitando classes Simples/Médio/Premium (02).
* 4.9 Resolução assistida de denúncias/suporte (mais autonomia, sempre com humano em ações de impacto).

## V5 — IA Generativa/Agêntica no Marketplace (engajamento e operação)

Alinhada a: `08` V5 (Gamificação com IA).

* **Gamificação com IA (08 V5):** missões, desafios e recompensas **personalizados** por IA,
  respeitando o anti-abuso de 08 e a validação backend (RN-06).
* Assistentes mais ricos (contratante e profissional) com memória contextual e proatividade controlada.
* Agentes operacionais para suporte/moderação de primeiro nível (sob RBAC e auditoria), com escalonamento
  humano obrigatório em decisões de impacto.
* Aprendizado contínuo com feedback humano (edições/overrides de CE-07/AUD-04) como sinal de melhoria.

> **Sequenciamento:** V3 só inicia após o marketplace ter **volume suficiente** de dados reais
> (princípio já adotado em 02 para o leilão de leads e em 06 para o aprendizado V3). Cada fase entrega
> código, migrations, testes, documentação e checklist de validação (regra de 01).

---

# 10. Conflitos e Observações

## 10.1 Dependência ausente — anti-fraud-engine

* **OBS-01 (bloqueante para 4.8).** O documento `anti-fraud-engine.md` é **referenciado** por este motor
  e citado implicitamente em 02 ("Sistema Anti-Fraude"), 07 ("Detecção de Fraude") e 08 ("Sistema
  Anti-Abuso"), mas **não existe** em `docs/`. A seção 4.8 descreve apenas a **camada de IA** que se
  apoiará nesse motor. **Recomenda-se criar `anti-fraud-engine.md`** definindo: regras determinísticas
  de fraude, `fraud_risk_score`, fluxos de suspensão/bloqueio, integração com 05 (chargeback) e 07
  (reputação). Até lá, 4.8 permanece dependente e parcialmente especificado.

## 10.2 Divergências de roadmap entre documentos (não resolvidas aqui)

* **OBS-02.** **Versão de IA divergente entre motores.** A IA aparece como **V3/V4** em 06 e 07,
  **V5** em 08, e **V3/V4** em 03 e 05. Este documento respeita cada roadmap de origem e os consolida
  por **capacidade**, não por número de versão único. Não há tentativa de renumerar os motores.
* **OBS-03.** **Níveis de gamificação inconsistentes entre 02 e 08.** O `02-lead-engine` define **6
  níveis** (até "Elite", 12000 XP); o `08-gamification-engine` define **8 níveis** (até "Lenda", 50000
  XP). A IA de ranking (4.7) e a gamificação por IA (V5) devem usar **08 como fonte canônica** de
  níveis, mas a divergência **não é resolvida por este documento** — fica registrada para alinhamento.
* **OBS-04.** **Pesos de reputação somam 100% mas há sobreposição conceitual.** Em 07, os componentes
  (avaliações 40%, resposta 15%, conversão 15%, comparecimento 10%, cancelamentos 10%, denúncias 10%)
  somam 100%; a reputação por IA (4.7) deve preservar essa soma como baseline antes de qualquer
  reponderação.

## 10.3 Novos campos e tabelas sugeridos (dependem de aprovação de 04)

Conforme a regra de 04 ("nenhuma tabela criada fora desta especificação sem aprovação"), os itens
abaixo são **propostas** da camada de IA, **não** alterações aprovadas:

**Novos campos sugeridos em tabelas existentes:**

| Tabela (04) | Campo sugerido | Finalidade |
|---|---|---|
| `leads` | `lead_quality_score` | Score de qualidade do lead (4.6) |
| `leads` | `conversion_probability` | Previsão de conversão (4.5) |
| `professional_profiles` | `ai_match_score` | Score auxiliar de ranking inteligente (4.7) |
| `professional_profiles` | `fraud_risk_score` | Risco de fraude por IA (4.8) |
| `customer_profiles` | `fraud_risk_score` | Risco de fraude do contratante (4.8) |
| `reviews` | `ai_flag` / `ai_review_status` | Avaliação marcada para revisão por IA (07/4.8) |
| `reports` | `ai_severity` / `ai_category` | Triagem de denúncias por IA (4.9) |

**Novas tabelas sugeridas (todas com `id` UUID, `created_at`, `updated_at`, e `deleted_at` quando crítico):**

| Tabela sugerida | Finalidade |
|---|---|
| `ai_inferences` | Registro de cada inferência de IA (entidade, tarefa, modelo, versão, input-hash, output, confiança, fallback) — base da auditoria (AUD-01) |
| `ai_models` | Catálogo/versionamento de modelos e prompts (AUD-02) |
| `ai_audit_logs` | Trilha de auditoria específica de IA, complementar a `audit_logs` (04) |
| `ai_feedback` | Edições/recusas/overrides humanos (CE-07, AUD-04) como sinal de treino |
| `ai_provider_config` | Configuração agnóstica de provedor (modelo, parâmetros, limites por ambiente — RN-14) |
| `fraud_signals` | Sinais agregados para o anti-fraud-engine (depende de OBS-01) |

## 10.4 Observações de consistência

* **OBS-05.** Os modelos Claude recomendados (`claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`)
  refletem o estado dos modelos Anthropic em **junho/2026**. A arquitetura agnóstica (RN-14) garante
  atualização sem reescrita; os IDs de modelo devem ser tratados como **configuração**, não como
  constantes embutidas no código.
* **OBS-06.** Este documento **não** define preço de leads nem altera a tabela de pacotes/preços de 05;
  apenas indica que a IA **informa** a precificação de leads dentro das classes Simples/Médio/Premium
  já estabelecidas (02/05).
* **OBS-07.** Toda a camada de IA pressupõe o stack de 03 (Next.js/FastAPI/PostgreSQL/Redis/S3). O
  módulo de IA deve viver como serviço/abstração dentro de `app/services/` (backend) seguindo a
  estrutura de pastas de 03, sem criar um produto separado (escopo de 2.2).
