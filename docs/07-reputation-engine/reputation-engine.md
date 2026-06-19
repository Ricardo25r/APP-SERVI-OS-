# reputation-engine.md

# Reputation Engine

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial de Reputação

---

# Objetivo

O Reputation Engine é responsável por construir confiança dentro da plataforma.

O objetivo não é apenas exibir estrelas.

O objetivo é medir a qualidade real dos usuários.

A reputação impacta diretamente:

* recebimento de leads
* ranking
* visibilidade
* conversão
* gamificação
* monetização

---

# Conceito

Toda ação gera reputação.

Toda ação negativa reduz reputação.

O sistema deve premiar consistência.

Não apenas avaliações.

---

# Reputation Score

Cada usuário possui:

```text
reputation_score
```

Escala:

0 a 1000 pontos

---

# Classificações

## Excelente

900 a 1000

---

## Muito Bom

800 a 899

---

## Bom

700 a 799

---

## Regular

500 a 699

---

## Atenção

300 a 499

---

## Crítico

0 a 299

---

# Componentes da Reputação

A reputação é composta por:

* avaliações
* resposta
* presença
* conclusão
* reclamações
* cancelamentos
* denúncias

---

# Peso das Avaliações

Peso total:

40%

---

5 estrelas

+20 pontos

---

4 estrelas

+10 pontos

---

3 estrelas

0

---

2 estrelas

-10 pontos

---

1 estrela

-20 pontos

---

# Tempo de Resposta

Peso:

15%

---

Menos de 5 minutos

+15

---

Menos de 15 minutos

+10

---

Menos de 1 hora

+5

---

Acima de 1 hora

0

---

# Taxa de Conversão

Peso:

15%

---

Fórmula

```text
Serviços Fechados
÷
Leads Comprados
```

---

Alta conversão

mais reputação

---

Baixa conversão

menos reputação

---

# Taxa de Comparecimento

Peso:

10%

---

Compareceu ao serviço

* pontos

---

Não compareceu

* pontos

---

# Cancelamentos

Peso:

10%

---

Cancelamento pelo profissional

reduz reputação

---

Cancelamento pelo contratante

não afeta profissional

---

# Denúncias

Peso:

10%

---

Denúncia válida

redução imediata

---

Denúncia falsa

nenhum impacto

---

# Score Inicial

Novo profissional

começa com:

500 pontos

---

# Evolução

O score deve mudar diariamente.

Nunca apenas no momento da avaliação.

---

# Reputação do Contratante

Clientes também possuem reputação.

---

Objetivo:

Evitar maus contratantes.

---

Critérios

* comparecimento
* pagamento
* respeito
* cancelamentos
* avaliações recebidas

---

# Selo de Confiabilidade

## Bronze

500+

---

## Prata

700+

---

## Ouro

850+

---

## Diamante

950+

---

# Impacto no Matching

Profissionais com maior reputação:

* aparecem primeiro
* recebem mais leads
* possuem prioridade

---

# Sistema Anti-Manipulação

Não permitir:

* autoavaliação
* avaliação duplicada
* contas falsas
* compra de avaliações

---

# Regras

Avaliação somente após:

* contato realizado
* lead comprado
* conversa iniciada

---

# Detecção de Fraude

Sinais:

* IP repetido
* dispositivo repetido
* padrão anormal
* múltiplas contas

---

# Avaliações Suspeitas

Marcar para revisão.

---

Não contabilizar até validação.

---

# Reclamações Graves

Exemplos:

* golpe
* assédio
* ameaça
* discriminação

---

Impacto imediato.

---

Pode gerar:

* suspensão
* bloqueio
* remoção

---

# Histórico

A reputação nunca deve ser apagada.

---

Manter:

* score atual
* score anterior
* histórico completo

---

# Dashboard Profissional

Exibir:

* score atual
* estrelas
* taxa de resposta
* taxa de comparecimento
* taxa de conversão
* reclamações
* posição no ranking

---

# Dashboard Cliente

Exibir:

* reputação
* avaliações recebidas
* cancelamentos
* contratações realizadas

---

# Métricas

Avaliação média

---

Tempo médio de resposta

---

Taxa de comparecimento

---

Taxa de contratação

---

Taxa de reclamação

---

NPS da plataforma

---

# Segurança

O usuário nunca pode:

* editar avaliações
* remover avaliações
* alterar reputação

---

Toda reputação é calculada exclusivamente pelo backend.

---

# Roadmap

V1

Regras fixas

---

V2

Score ponderado

---

V3

Reputação baseada em IA

---

V4

Reputação preditiva

---

# Definição de Sucesso

O Reputation Engine deve fazer com que:

* bons profissionais cresçam;
* maus profissionais percam visibilidade;
* bons contratantes sejam valorizados;
* a confiança dentro da plataforma aumente continuamente.

A reputação deve se tornar um ativo digital valioso para todos os usuários da plataforma.
