# anti-fraud-engine.md

# Anti Fraud Engine

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial de Prevenção a Fraudes

---

# Objetivo

O Anti Fraud Engine é responsável por proteger:

* reputação
* créditos
* pagamentos
* ranking
* avaliações
* leads
* receita

Sem este módulo o marketplace se torna vulnerável a manipulações e perde credibilidade.

---

# Princípios

O sistema deve assumir que:

* usuários tentarão burlar regras;
* avaliações podem ser manipuladas;
* créditos podem ser explorados;
* leads falsos podem ser criados;
* contas duplicadas existirão.

Toda regra deve ser validada no backend.

Nunca confiar no frontend.

---

# Tipos de Fraude

## Fraude de Cadastro

Usuário cria múltiplas contas.

Objetivo:

* ganhar bônus
* ganhar créditos
* manipular ranking

---

## Fraude de Avaliação

Usuário cria contas falsas para:

* aumentar reputação
* reduzir reputação de concorrentes

---

## Fraude de Leads

Criar oportunidades falsas para:

* beneficiar terceiros
* gerar avaliações artificiais
* manipular ranking

---

## Fraude Financeira

Chargeback

Cartão roubado

PIX fraudulento

Manipulação de créditos

---

## Fraude de Reputação

Auto contratação

Avaliações combinadas

Rede de avaliações falsas

---

# Motor de Risco

Cada usuário possui:

```text
fraud_score
```

Escala:

0 a 100

---

# Classificação

0 a 20

Baixo risco

---

21 a 50

Médio risco

---

51 a 80

Alto risco

---

81 a 100

Crítico

---

# Sinais de Risco

## Múltiplas Contas

Mesmo:

* CPF
* telefone
* e-mail
* dispositivo
* IP

---

Aumenta score.

---

## Dispositivo Compartilhado

Mesmo aparelho em diversas contas.

---

Detectar:

* fingerprint
* device id
* browser id

---

## IP Suspeito

Mudanças excessivas.

---

VPN

Proxy

Datacenter

---

Aumentar score.

---

# Fraude de Avaliações

Detectar:

Avaliações rápidas demais.

---

Avaliações recíprocas.

---

Grupo fechado de usuários.

---

Padrões repetitivos.

---

Avaliações sempre máximas.

---

# Regras

Avaliação só permitida quando:

* lead comprado
* conversa iniciada
* serviço encerrado

---

# Auto Contratação

Detectar:

Mesmo CPF

Mesmo dispositivo

Mesmo IP

Mesmo endereço

---

Bloquear imediatamente.

---

# Manipulação de Ranking

Detectar:

* explosão de avaliações
* crescimento anormal
* atividade fora do padrão

---

Enviar para revisão.

---

# Fraude de Leads

Detectar:

* leads repetidos
* textos duplicados
* números repetidos
* contas recém criadas

---

Marcar para análise.

---

# Fraude Financeira

Monitorar:

* chargebacks
* pagamentos recusados
* PIX suspeitos

---

Ao detectar:

Suspender privilégios.

---

# Sistema de Bloqueios

## Nível 1

Alerta

---

## Nível 2

Limitação

---

Exemplos:

* sem bônus
* sem ranking

---

## Nível 3

Suspensão

---

Sem compra de leads.

---

## Nível 4

Bloqueio

---

Conta congelada.

---

## Nível 5

Banimento Permanente

---

Conta encerrada.

---

# Revisão Manual

Casos críticos devem ir para moderação.

---

Administrador recebe:

Motivo

Usuário

Evidências

Histórico

---

# Auditoria

Registrar:

* login
* IP
* dispositivo
* compra
* avaliação
* denúncia
* alteração de perfil

---

Nunca apagar registros.

---

# Sistema de Denúncias

Usuários podem denunciar:

* golpe
* assédio
* comportamento inadequado
* perfil falso

---

Cada denúncia gera protocolo.

---

# Inteligência Antifraude

Calcular diariamente:

* risco do usuário
* risco da conta
* risco financeiro

---

Atualizar fraud_score.

---

# Regras de Bônus

Usuários sob investigação:

Não recebem:

* créditos bônus
* recompensas
* promoções

---

# Proteção de Créditos

Toda movimentação deve possuir:

* origem
* destino
* motivo
* usuário
* timestamp

---

Não permitir alteração direta de saldo.

---

Saldo sempre calculado por transações.

---

# Segurança de APIs

Implementar:

* rate limit
* proteção contra bots
* captcha em ações críticas
* validação de sessão

---

# Dashboard Administrativo

Exibir:

Usuários suspeitos

Fraud Score

Denúncias

Chargebacks

Avaliações suspeitas

Leads suspeitos

Contas duplicadas

---

# Métricas

Fraudes detectadas

Fraudes confirmadas

Chargebacks

Contas bloqueadas

Avaliações removidas

Leads inválidos

---

# Roadmap

V1

Regras fixas

---

V2

Detecção comportamental

---

V3

Machine Learning

---

V4

IA antifraude

---

# Definição de Sucesso

O sistema deve impedir que usuários obtenham vantagem injusta.

A reputação deve refletir a realidade.

Os créditos devem ser protegidos.

Os rankings devem permanecer confiáveis.

A plataforma deve crescer sem perder credibilidade.
