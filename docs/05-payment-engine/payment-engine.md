# payment-engine.md

# Payment Engine

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial de Monetização

---

# Objetivo

O Payment Engine é responsável por:

* venda de créditos
* assinatura premium
* perfil verificado
* reembolsos
* estornos
* auditoria financeira

Toda receita da plataforma deve passar por este módulo.

---

# Fontes de Receita

## Receita 1

Compra de Créditos

Principal fonte de receita.

---

## Receita 2

Perfil Verificado

Pagamento único.

---

## Receita 3

Assinatura Premium

Pagamento recorrente.

---

## Receita 4 (Futura)

Destaque Patrocinado

Profissional paga para aparecer primeiro.

---

## Receita 5 (Futura)

Impulsionamento de Perfil

Promoção temporária.

---

# Sistema de Créditos

Os créditos são a moeda oficial da plataforma.

---

# Regras

Créditos:

* não podem ser transferidos
* não podem ser sacados
* não podem ser vendidos
* não possuem valor monetário externo

---

# Pacotes de Créditos

Configuração inicial:

Pacote Starter

10 créditos

R$ 19,90

---

Pacote Profissional

50 créditos

R$ 69,90

---

Pacote Avançado

100 créditos

R$ 119,90

---

Pacote Elite

250 créditos

R$ 249,90

---

Pacote Empresarial

500 créditos

R$ 449,90

---

# Consumo de Créditos

Lead Simples

1 crédito

---

Lead Médio

3 créditos

---

Lead Premium

5 créditos

---

# Perfil Verificado

Objetivo:

Gerar confiança.

---

Valor inicial:

R$ 19,90

Pagamento único.

---

Benefícios:

* selo verificado
* destaque visual
* maior confiança

---

# Processo de Verificação

Usuário envia:

* documento
* selfie
* telefone validado

---

Administrador aprova.

---

Sistema libera selo.

---

# Assinatura Premium

Modelo recorrente.

---

Plano Mensal

R$ 29,90

---

Plano Trimestral

R$ 79,90

---

Plano Anual

R$ 249,90

---

# Benefícios Premium

Maior exposição

Maior prioridade

Filtro premium

Mais visibilidade

Destaque em buscas

---

# Gateways de Pagamento

MVP

Implementar:

PIX

Cartão

---

Provedores sugeridos:

* Mercado Pago
* Asaas
* Pagar.me
* Stripe

Escolher apenas um inicialmente.

---

# Fluxo de Compra de Créditos

Usuário escolhe pacote

↓

Sistema cria pedido

↓

Gateway gera cobrança

↓

Pagamento aprovado

↓

Webhook recebido

↓

Saldo atualizado

↓

Histórico registrado

↓

Notificação enviada

---

# Fluxo de Assinatura

Usuário escolhe plano

↓

Gateway cria assinatura

↓

Webhook confirma

↓

Premium ativado

↓

Renovação automática

---

# Fluxo de Perfil Verificado

Usuário solicita verificação

↓

Pagamento aprovado

↓

Documentos enviados

↓

Análise administrativa

↓

Aprovado

↓

Selo liberado

---

# Reembolsos

Permitidos apenas quando:

* lead inválido
* contato inexistente
* fraude comprovada
* erro da plataforma

---

# Regras de Reembolso

Não devolver dinheiro.

Devolver créditos.

---

Exemplo

Lead custou:

3 créditos

↓

Problema validado

↓

3 créditos retornam à carteira

---

# Chargeback

Ao receber chargeback:

* bloquear créditos adquiridos
* suspender conta
* enviar para análise

---

# Carteira de Créditos

Cada profissional possui:

wallet

---

Campos:

saldo atual

saldo total adquirido

saldo consumido

saldo bônus

---

# Histórico Financeiro

Toda movimentação deve gerar registro.

Nunca apagar.

Nunca editar.

---

Registrar:

* compra
* consumo
* bônus
* estorno
* ajuste administrativo

---

# Painel Financeiro Admin

Exibir:

Receita diária

Receita mensal

Créditos vendidos

Créditos consumidos

Assinaturas ativas

Perfis verificados

Reembolsos

Chargebacks

---

# Relatórios

Receita por dia

Receita por cidade

Receita por categoria

Receita por profissional

Ticket médio

LTV

MRR

ARR

---

# Segurança

Obrigatório:

* Webhooks assinados
* Idempotência
* Logs financeiros
* Auditoria
* Anti fraude

---

# Auditoria

Toda operação financeira deve gerar:

Usuário

Valor

Data

IP

Origem

Resultado

---

# Métricas de Negócio

Meta Inicial

Ticket Médio:

R$ 50+

---

Conversão de Compra:

10%+

---

Assinatura Premium:

5% dos profissionais

---

Retenção:

70%+

---

# Roadmap Futuro

V2

Pagamento recorrente avançado

---

V3

Carteira digital

---

V4

Leilão de Leads

---

V5

Marketplace Corporativo

---

# Definição de Sucesso

O sistema financeiro deve ser:

* auditável
* seguro
* simples para o usuário
* altamente escalável

Toda monetização da plataforma deve passar pelo Payment Engine.
