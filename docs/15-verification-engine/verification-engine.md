# verification-engine.md

# Verification Engine

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial

---

> Documento complementar. O **fluxo de pagamento** do Perfil Verificado (R$ 19,90, pagamento único) pertence ao `05-payment-engine`. Este documento foca exclusivamente na **verificação de identidade (KYC)** que sucede o pagamento e antecede a liberação do selo.
>
> Fonte da verdade do schema: `04-banco-de-dados/database-schema.md` (tabela `verification_requests`). Selo de confiança e reputação: `07-reputation-engine`. Arquitetura e storage: `03-arquitetura/marketplace-architecture.md`.

---

# 1. Objetivo

O Verification Engine é responsável por **validar a identidade real dos usuários** da plataforma FazTudo, transformando uma solicitação paga em um **Perfil Verificado** com selo de confiança.

Responsabilidades:

* validar identidade (KYC)
* receber e armazenar documentos de identificação (frente/verso)
* receber e armazenar selfie do solicitante
* operar o fluxo de validação manual feito por moderadores
* registrar estados da solicitação (`pending`, `approved`, `rejected`)
* registrar motivo de rejeição
* bloquear reenvios indevidos e tentativas de fraude documental
* garantir auditoria completa (quem revisou, quando)
* garantir segurança, privacidade e conformidade com a LGPD

O objetivo de negócio é **gerar confiança**, aumentar conversão de Leads e reduzir fraude de identidade no marketplace.

---

# 2. Escopo

## 2.1 Dentro do escopo

* verificação de identidade de **profissionais** (público primário do Perfil Verificado)
* verificação de identidade de **contratantes** (futuro / opcional — ver Roadmap)
* níveis de verificação (KYC)
* upload, armazenamento e ciclo de vida dos documentos e da selfie
* fluxo do moderador (validação manual) no Painel Administrativo
* estados, transições e motivos de rejeição
* bloqueios e regras de reenvio
* auditoria da revisão
* segurança, criptografia e retenção dos dados sensíveis

## 2.2 Fora do escopo (referenciado, não duplicado)

* **Cobrança do Perfil Verificado (R$ 19,90, pagamento único)** → `05-payment-engine`
* **Exibição do selo, peso na reputação e selos de confiabilidade (Bronze/Prata/Ouro/Diamante)** → `07-reputation-engine`
* **Detecção de fraude transversal (multicontas, device fingerprint, padrões anômalos)** → `anti-fraud-engine` *(documento disponível em docs/19 — ver Conflitos e Observações)*
* **Validação automática de telefone** → módulo de Autenticação / Payment Engine (o telefone validado é pré-requisito, não objeto deste engine)
* **Painel Administrativo (estrutura geral)** → módulo administrativo (`03-arquitetura`); aqui descrevemos apenas a tela de moderação de documentos.

---

# 3. Regras de Negócio

## 3.1 Pré-requisitos para abrir uma verificação

Uma solicitação de verificação (`verification_requests`) só pode ser criada quando:

1. o usuário possui conta `active` (ver `users.status` em `04`);
2. o telefone está validado (`users.phone` confirmado);
3. o **pagamento do Perfil Verificado foi aprovado** no Payment Engine (`payment_orders.status = paid` referente ao item Perfil Verificado).

> A ordem oficial é: **pagamento aprovado → envio de documentos → análise → aprovação → selo liberado** (conforme `05-payment-engine`, "Fluxo de Perfil Verificado").

## 3.2 Documentos exigidos

| Item | Campo no schema | Obrigatório |
|------|-----------------|-------------|
| Documento — frente | `document_front_url` | Sim |
| Documento — verso | `document_back_url` | Sim (exceto CNH-e digital, ver 5.x) |
| Selfie | `selfie_url` | Sim |

### Tipos de documento aceitos

* **RG** (Registro Geral) — frente e verso obrigatórios.
* **CNH** (Carteira Nacional de Habilitação) — frente e verso; a CNH digital (CNH-e) é aceita como imagem do documento aberto.

Não são aceitos no MVP: passaporte, CTPS, comprovantes de endereço, documentos rasurados, fotocópias de baixa qualidade ou capturas de tela de outro documento.

## 3.3 Requisitos das imagens

* formato: JPG, JPEG ou PNG;
* documento legível, sem corte de bordas, sem reflexo que oculte dados;
* selfie com rosto descoberto, frontal, iluminação adequada;
* o rosto da selfie deve ser **compatível** com a foto do documento (verificação humana no MVP; biométrica no futuro).

## 3.4 Unicidade e estado

* Um usuário só pode ter **uma** solicitação `pending` por vez.
* Um usuário com solicitação `approved` ativa **não** abre nova solicitação, exceto em caso de reverificação solicitada pela plataforma.
* O `reputation_engine` é o único responsável por exibir/atribuir o selo; este engine apenas sinaliza `professional_profiles.verified = true` após `approved`.

## 3.5 Resultado da verificação

* **approved** → marca `professional_profiles.verified = true` e dispara liberação do selo (Reputation Engine) e notificação.
* **rejected** → registra `rejection_reason`, mantém `verified = false`, notifica o usuário e abre janela de reenvio (ver 5).

---

# 4. Níveis de Verificação (KYC)

A plataforma adota níveis progressivos de confiança. O MVP entrega o **Nível 1 e Nível 2**; os demais são roadmap.

| Nível | Nome | Validações | Status |
|-------|------|------------|--------|
| **N0** | Conta básica | e-mail + senha | Atual (sem verificação) |
| **N1** | Contato verificado | telefone validado | Atual (pré-requisito) |
| **N2** | **Identidade verificada** | documento (frente/verso) + selfie + análise manual | **MVP — escopo deste engine** |
| **N3** | Prova de vida | liveness / biometria facial automática | Futuro |
| **N4** | KYC reforçado | provedor KYC de mercado + OCR + validação de base oficial | Futuro |

O selo "Perfil Verificado" do FazTudo corresponde ao **N2**. Os níveis N3/N4 reaproveitam a mesma tabela `verification_requests` com extensões propostas na seção de Modelo de Dados.

---

# 5. Fluxos

## 5.1 Fluxo principal — Verificação de Identidade (N2, validação manual)

```text
Pagamento do Perfil Verificado aprovado (Payment Engine)
        ↓
Usuário acessa "Verificar identidade"
        ↓
Seleciona tipo de documento (RG | CNH)
        ↓
Envia documento frente + verso + selfie
        ↓
Sistema cria verification_requests (status = pending)
        ↓
Documentos gravados criptografados no S3 (acesso restrito)
        ↓
Solicitação entra na fila de moderação
        ↓
Moderador analisa (compara selfie x documento, legibilidade, autenticidade)
        ↓
   ┌─────────────┴─────────────┐
APROVA                       REJEITA
   ↓                            ↓
status = approved          status = rejected
reviewer_id, reviewed_at   reviewer_id, reviewed_at, rejection_reason
   ↓                            ↓
verified = true            notificação com motivo
selo liberado (Reputation)      ↓
   ↓                       janela de reenvio (se elegível)
notificação de sucesso
```

## 5.2 Fluxo do moderador (validação manual)

Tela de Moderação de Documentos (Painel Admin → Moderação → Documentos):

1. Moderador abre a fila de solicitações com `status = pending` (ordenadas por `created_at`).
2. Visualiza imagens via **URLs temporárias assinadas** (nunca URL pública permanente).
3. Checklist de análise:
   * documento dentro dos tipos aceitos (RG/CNH);
   * frente e verso legíveis e íntegros;
   * dados consistentes entre frente e verso;
   * selfie corresponde à pessoa do documento;
   * ausência de indícios de adulteração (montagem, edição, foto de tela).
4. Decisão:
   * **Aprovar** → `status = approved`, grava `reviewer_id` e `reviewed_at`.
   * **Rejeitar** → `status = rejected`, grava `reviewer_id`, `reviewed_at` e `rejection_reason` (motivo obrigatório, selecionado de lista padronizada + observação livre opcional).
5. Toda decisão gera registro em `admin_actions` e `audit_logs` (ver Auditoria).

### Estados e transições

```text
pending ──aprovar──▶ approved   (terminal positivo)
pending ──rejeitar─▶ rejected   (permite reenvio, se elegível)
rejected ──reenvio─▶ pending    (nova análise)
```

`approved` é terminal (salvo reverificação administrativa, que cria nova solicitação).

### Motivos de rejeição padronizados (`rejection_reason`)

| Código | Descrição | Reenvio permitido |
|--------|-----------|-------------------|
| `illegible_document` | Documento ilegível / baixa qualidade | Sim |
| `incomplete_document` | Falta frente ou verso | Sim |
| `unsupported_document` | Tipo de documento não aceito | Sim |
| `selfie_mismatch` | Selfie não corresponde ao documento | Sim (limitado) |
| `expired_document` | Documento vencido | Sim |
| `suspected_fraud` | Indício de adulteração / documento de terceiros | **Não (bloqueio)** |
| `duplicate_identity` | Documento já vinculado a outra conta | **Não (bloqueio)** |

## 5.3 Fluxo futuro — Validação automática (N3/N4)

> **Futuro. Não faz parte do MVP.**

```text
Upload de documento + selfie
        ↓
OCR extrai dados do documento (nome, número, validade)
        ↓
Liveness / prova de vida (detecção de foto-de-foto e vídeo)
        ↓
Biometria facial: compara selfie x foto do documento
        ↓
Consulta a provedor KYC de mercado (base oficial)
        ↓
   ┌────────┴────────┐
score alto         score baixo / dúvida
   ↓                    ↓
auto-approved      fila de revisão manual (fallback)
```

Provedores KYC de mercado considerados (a definir, escolher um inicialmente): Unico, Idwall, CAF, Serpro/Datavalid, Veriff. A escolha e contratação são tratadas fora deste documento.

---

# 6. Casos Especiais

* **Selfie x documento divergentes:** rejeição com `selfie_mismatch`; reenvio permitido com limite de tentativas.
* **Documento de terceiros:** rejeição com `suspected_fraud`; **bloqueio** e encaminhamento ao anti-fraud-engine.
* **Documento já usado por outra conta (`duplicate_identity`):** bloqueio de ambas as contas suspeitas para investigação.
* **Pagamento aprovado mas usuário não envia documentos:** solicitação permanece "aguardando envio"; não há reembolso em dinheiro (regra do Payment Engine: devolução é em créditos quando aplicável). O direito à verificação fica pendente até o envio.
* **Conta suspensa/bloqueada durante análise:** solicitação `pending` é congelada; moderador não decide até regularização.
* **Reverificação administrativa:** a plataforma pode exigir nova verificação (ex.: denúncia validada). Cria-se nova `verification_requests`; o selo pode ser temporariamente suspenso pelo Reputation Engine.
* **Mudança de documento:** usuário N2 que troca de documento (ex.: RG → CNH) só reverifica mediante solicitação justificada.
* **Reenvio após rejeição:** permitido apenas para motivos elegíveis (ver tabela 5.2), respeitando limite de tentativas (proposta: máx. 3 reenvios por solicitação original em janela de 30 dias).

---

# 7. Segurança e Privacidade

Documentos e selfie são **dados pessoais sensíveis** (identidade e biometria) e recebem tratamento reforçado.

## 7.1 Armazenamento

* Imagens armazenadas em **S3-compatible** (MinIO em desenvolvimento, Cloudflare R2 em produção — conforme `03-arquitetura`).
* **Criptografia em repouso** (server-side encryption) e **em trânsito** (HTTPS/TLS).
* Buckets **privados**: nenhuma imagem com URL pública permanente.
* Acesso somente via **URLs temporárias assinadas** com expiração curta, geradas sob demanda para o moderador.
* O banco (`verification_requests`) guarda apenas as **chaves/URLs internas**, nunca a imagem em si.

## 7.2 Controle de acesso

* Acesso restrito por **RBAC**: somente `admin`/moderador autorizado pode visualizar documentos.
* Proteção contra **IDOR**: validação de ownership e de papel em toda requisição de imagem.
* Rate limiting nos endpoints de upload e de geração de URL assinada.
* Webhooks e integrações futuras (KYC) com assinatura e idempotência (padrão do Payment Engine).

## 7.3 LGPD e privacidade

* **Finalidade:** os dados são coletados exclusivamente para verificação de identidade; vedado uso para outros fins.
* **Minimização:** coletar apenas o necessário (documento + selfie); não persistir dados além do exigido.
* **Consentimento:** usuário aceita termo específico de tratamento de dados sensíveis no início do fluxo.
* **Retenção mínima:** após decisão, manter as imagens apenas pelo período necessário à comprovação e a obrigações legais; após o prazo, **descartar/anonimizar** (proposta: expurgo das imagens em até 90 dias após `approved`/`rejected`, preservando-se apenas o registro de auditoria sem a imagem).
* **Direitos do titular:** atender solicitações de acesso e exclusão conforme LGPD, ressalvadas obrigações legais de retenção.
* **Soft delete:** o registro `verification_requests` segue a regra de integridade do `04` (não remoção física de registros críticos); o **expurgo aplica-se ao arquivo de imagem no S3**, não ao registro de auditoria.

---

# 8. Auditoria

Toda ação de verificação é rastreável, alinhada às regras de `04-banco-de-dados` ("toda ação administrativa deve gerar auditoria") e ao padrão do Payment Engine.

Registrar:

* **Quem revisou:** `verification_requests.reviewer_id` (FK → `users.id`, role admin).
* **Quando revisou:** `verification_requests.reviewed_at`.
* **Decisão e motivo:** `status` e `rejection_reason`.
* **Ação administrativa:** linha em `admin_actions` (`admin_id`, `action`, `target_entity = verification_requests`, `target_id`, `reason`).
* **Trilha técnica:** linha em `audit_logs` (`user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`).
* **Acesso a imagem:** cada geração de URL assinada para visualização também deve gerar `audit_logs` (quem acessou qual documento e quando).

Registros de auditoria **nunca** são apagados ou editados (regra de integridade do `04`).

---

# 9. Métricas

KPIs operacionais e de negócio do engine:

* **Taxa de aprovação:** `approved / total de solicitações`.
* **Taxa de rejeição** e distribuição por `rejection_reason`.
* **Tempo médio de análise:** `reviewed_at - created_at`.
* **Tempo na fila** (pending) — SLA de moderação.
* **Taxa de reenvio** e taxa de aprovação após reenvio.
* **Tentativas de fraude documental** detectadas (`suspected_fraud`, `duplicate_identity`).
* **Conversão pós-pagamento:** % de pagamentos do Perfil Verificado que viram envio de documento e que viram `approved`.
* **Impacto no negócio:** correlação entre Perfil Verificado e conversão de Leads / receita (ver `05` e `07`).

SLA proposto de moderação manual: **até 48h úteis** entre `created_at` e decisão.

---

# 10. Roadmap

| Versão | Entrega |
|--------|---------|
| **V1 (MVP)** | Verificação N2 manual: upload (RG/CNH frente+verso + selfie), fila de moderação, estados pending/approved/rejected, motivo de rejeição, auditoria, storage criptografado, regras LGPD. |
| **V2** | OCR para extração de dados do documento; checklist semiautomático para o moderador; limites de reenvio automatizados. |
| **V3** | Liveness / prova de vida e biometria facial (comparação selfie x documento automática) — Nível N3. |
| **V4** | Integração com provedor KYC de mercado e base oficial; auto-aprovação por score com fallback manual — Nível N4. |
| **V5** | Verificação de contratantes; reverificação periódica; verificação de empresa/CNPJ para Marketplace Corporativo (alinhado ao roadmap do Payment Engine). |

---

# Modelo de Dados (proposta complementar)

O schema oficial é o de `04-banco-de-dados`. A tabela `verification_requests` já existe com:

```text
id
user_id
document_front_url
document_back_url
selfie_url
status              (pending | approved | rejected)
reviewer_id
reviewed_at
created_at
```

Para suportar este engine, **propõem-se** as seguintes extensões (sujeitas à aprovação prevista no `04`):

### Extensões em `verification_requests`

| Campo proposto | Tipo | Finalidade |
|----------------|------|-----------|
| `document_type` | enum (`rg`, `cnh`) | Tipo de documento enviado |
| `kyc_level` | enum (`n2`, `n3`, `n4`) | Nível de verificação atingido (default `n2`) |
| `rejection_reason` | enum (ver 5.2) | Motivo padronizado da rejeição |
| `rejection_notes` | text (nullable) | Observação livre do moderador |
| `attempt_number` | int | Controle de reenvios (default 1) |
| `updated_at` | timestamp | Padrão de datas do `04` |
| `expires_at` | timestamp (nullable) | Expurgo/retenção das imagens (LGPD) |

### Tabela proposta — `verification_document_access` (log de acesso a imagens, LGPD)

| Campo | Tipo | Finalidade |
|-------|------|-----------|
| `id` | UUID | PK |
| `verification_request_id` | UUID | FK → `verification_requests.id` |
| `admin_id` | UUID | FK → `users.id` (quem visualizou) |
| `document_field` | enum (`document_front`, `document_back`, `selfie`) | O que foi acessado |
| `accessed_at` | timestamp | Quando |
| `ip_address` | string | Origem |

> Caso a auditoria de acesso seja considerada suficiente via `audit_logs`, esta tabela pode ser dispensada. Mantida como proposta para granularidade LGPD.

---

# Conflitos e Observações

1. **Divergência de schema entre `04` e `03`.** `04-banco-de-dados` (fonte da verdade) define `verification_requests` com `document_front_url`, `document_back_url`, `selfie_url`, `reviewer_id`, `reviewed_at`. Já `03-arquitetura` define a mesma tabela com `document_url` (único) e `reviewed_by`. **Este documento segue o `04`** (frente/verso separados; `reviewer_id`). Recomenda-se corrigir `03` para alinhar ao `04`.

2. **Idioma dos status.** `04` usa `pending/approved/rejected` (inglês); `03` usa `pendente/aprovado/rejeitado` (português). Adotamos o padrão do `04` (inglês). Recomenda-se padronização global.

3. **Campos ausentes no schema oficial.** `verification_requests` não possui `rejection_reason`, `document_type`, `kyc_level`, `updated_at` nem campos de retenção. As regras deste engine (motivo de rejeição, tipos RG/CNH, níveis KYC, expurgo LGPD) dependem das extensões propostas em "Modelo de Dados".

4. **`anti-fraud-engine.md` disponível (dependência — docs/19).** Casos de `suspected_fraud` e `duplicate_identity` referenciam o motor anti-fraude, agora documentado em `docs/19-anti-fraud-engine/anti-fraud-engine.md`. O tratamento de fraude documental (bloqueio manual e encaminhamento via `reports`/`admin_actions`) pode ser complementado pela integração com o motor central, a detalhar na implementação.

5. **Fronteira com o Payment Engine.** O pagamento do Perfil Verificado (R$ 19,90, único) e seu fluxo de cobrança são do `05-payment-engine` e **não** foram redefinidos aqui. Este engine inicia somente após `payment_orders` referente ao Perfil Verificado estar `paid`.

6. **Selo de confiança.** A exibição e o peso do selo são do `07-reputation-engine`. Atenção à possível ambiguidade de nomenclatura: o `07` define os "Selos de Confiabilidade" Bronze/Prata/Ouro/Diamante baseados em `reputation_score`, que são **distintos** do "selo de Perfil Verificado" (identidade). Recomenda-se diferenciar claramente os dois selos na UI.

7. **Validação de telefone.** O `05` lista "telefone validado" como parte do Perfil Verificado, mas a validação de telefone é responsabilidade do módulo de Autenticação. Aqui tratada apenas como pré-requisito (N1), não como objeto do Verification Engine.

8. **Numeração do documento.** Não havia documento `09` em `docs/` no momento da redação (Painel Administrativo não encontrado). Este documento foi criado como `15-verification-engine` conforme solicitado; recomenda-se confirmar a sequência oficial de numeração.
