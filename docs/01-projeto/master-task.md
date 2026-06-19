# claude-code-master-task.md

# PROJETO

FazTudo

Marketplace Inteligente de Prestadores de Serviços Locais

---

# OBJETIVO

Criar uma plataforma web responsiva onde pessoas possam encontrar profissionais para:

* serviços pontuais
* serviços temporários
* contratação fixa

A plataforma deverá futuramente evoluir para aplicativo Android e iOS.

Nesta fase desenvolver apenas a versão WEB.

---

# CONCEITO CENTRAL

Conectar demanda local com profissionais disponíveis.

Diferencial:

Não é um catálogo.

É um marketplace de oportunidades.

O profissional paga para acessar oportunidades qualificadas.

---

# TIPOS DE CONTRATAÇÃO

## Serviço Pontual

Exemplos:

* eletricista
* encanador
* pintor
* diarista

---

## Serviço Temporário

Exemplos:

* babá por temporada
* cuidador temporário
* doméstica por período

---

## Contratação Permanente

Exemplos:

* empregada doméstica
* babá fixa
* cuidador fixo

---

# PERFIS DO SISTEMA

## Contratante

Pode:

* criar solicitações
* conversar com profissionais
* avaliar profissionais
* favoritar profissionais

Não paga.

---

## Profissional

Pode:

* criar perfil
* receber oportunidades
* comprar leads
* responder interessados
* receber avaliações

Paga por créditos.

---

## Administrador

Pode:

* moderar usuários
* validar profissionais
* gerenciar pagamentos
* gerenciar categorias
* visualizar métricas

---

# MVP

Implementar apenas:

## Cadastro

* login
* recuperação de senha
* autenticação

---

## Perfis

Contratante

Profissional

Administrador

---

## Solicitações

Criar oportunidade

Visualizar oportunidade

Editar oportunidade

Cancelar oportunidade

---

## Leads

Sistema de créditos

Compra de leads

Desbloqueio de contato

Histórico de leads

---

## Avaliações

Avaliação mútua

Nota de 1 a 5

Comentário

---

## Chat

Mensagens internas

Sem WhatsApp inicialmente

---

## Pagamentos

Compra de créditos

Pix

Cartão

---

## Dashboard Profissional

Saldo de créditos

Leads comprados

Avaliações

Nível

Medalhas

---

# GAMIFICAÇÃO

Criar estrutura preparada para:

* XP
* níveis
* medalhas
* ranking
* conquistas

Mesmo que inicialmente não esteja ativa.

---

# NÍVEIS

Iniciante

Confiável

Profissional

Especialista

Referência Regional

Elite

---

# SELOS

Verificado

Premium

Resposta Rápida

Top Avaliado

Mais Contratado

---

# MONETIZAÇÃO

## Créditos

Pacotes configuráveis.

Exemplo:

10 créditos

50 créditos

100 créditos

---

## Perfil Verificado

Pagamento único.

---

## Perfil Premium

Assinatura mensal.

---

# ARQUITETURA

Frontend:

Next.js

TypeScript

Tailwind

Shadcn

React Query

---

Backend:

FastAPI

Python

SQLAlchemy

Pydantic

---

Banco:

PostgreSQL

---

Cache:

Redis

---

Storage:

S3 Compatible

---

# SEGURANÇA

Implementar desde o início:

* RBAC
* Multi Tenant Ready
* Auditoria
* JWT
* Rate Limit
* Soft Delete
* Ownership Validation

---

# FASES DE IMPLEMENTAÇÃO

FASE 1

Infraestrutura

---

FASE 2

Autenticação

---

FASE 3

Perfis

---

FASE 4

Solicitações

---

FASE 5

Sistema de Leads

---

FASE 6

Pagamentos

---

FASE 7

Avaliações

---

FASE 8

Chat

---

FASE 9

Gamificação

---

FASE 10

Administração

---

# IMPORTANTE

Implementar uma fase por vez.

Não pular etapas.

Não criar funcionalidades não solicitadas.

Ao final de cada fase gerar:

* código
* migrations
* testes
* documentação
* checklist de validação

Somente após concluir uma fase iniciar a próxima.
