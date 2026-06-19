# matching-engine.md

# Matching Engine

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial de Distribuição de Leads

---

# Objetivo

O Matching Engine é responsável por determinar:

* quais profissionais recebem cada lead;
* em qual ordem recebem;
* qual prioridade possuem;
* como evitar concentração de oportunidades;
* como aumentar a conversão dos leads.

Este é um dos módulos mais importantes da plataforma.

Uma distribuição ruim destrói o marketplace.

Uma distribuição inteligente aumenta:

* receita;
* retenção;
* satisfação;
* conversão.

---

# Conceito

Quando um contratante cria uma solicitação:

O sistema não deve enviar para todos.

O sistema deve identificar os profissionais mais compatíveis.

---

# Fluxo Geral

Cliente cria solicitação

↓

Lead validado

↓

Lead classificado

↓

Matching Engine executa

↓

Profissionais elegíveis encontrados

↓

Ranking calculado

↓

Lead distribuído

↓

Profissionais compram o lead

---

# Critérios de Elegibilidade

Um profissional só participa do matching se:

* estiver ativo
* não estiver suspenso
* possuir créditos suficientes
* possuir categoria compatível
* estiver dentro da área de atendimento
* estiver disponível

---

# Filtros Obrigatórios

## Categoria

Exemplo:

Lead:

Eletricista

↓

Somente eletricistas recebem.

---

## Cidade

Exemplo:

Lead:

Ariquemes

↓

Somente profissionais de Ariquemes.

---

## Área de Atendimento

Cada profissional define:

* cidade
* raio de atuação

Exemplo:

15km

30km

50km

---

# Disponibilidade

Status:

Available

Busy

Unavailable

---

Unavailable

Não recebe leads.

---

Busy

Recebe menos leads.

---

Available

Recebe normalmente.

---

# Sistema de Score

Cada profissional recebe uma pontuação.

---

# Fórmula Inicial

Matching Score

=

Categoria

*

Distância

*

Reputação

*

Disponibilidade

*

Tempo de Resposta

*

Nível

---

# Peso da Categoria

Obrigatório.

Peso:

100 pontos

---

# Distância

Até 5 km

100 pontos

---

Até 15 km

80 pontos

---

Até 30 km

50 pontos

---

Acima disso

20 pontos

---

# Reputação

5 estrelas

100 pontos

---

4.5 estrelas

80 pontos

---

4 estrelas

60 pontos

---

Abaixo disso

40 pontos

---

# Tempo de Resposta

Menos de 5 minutos

100 pontos

---

Menos de 15 minutos

80 pontos

---

Menos de 1 hora

50 pontos

---

Mais de 1 hora

20 pontos

---

# Nível

Elite

100 pontos

---

Referência Regional

80 pontos

---

Especialista

60 pontos

---

Profissional

40 pontos

---

Confiável

20 pontos

---

Iniciante

10 pontos

---

# Distribuição Inteligente

Objetivo:

Evitar concentração.

---

Problema:

Os melhores profissionais recebem tudo.

Os novos não recebem nada.

---

Solução:

Balanceamento.

---

Regra:

20% dos leads reservados para novos profissionais.

---

80% seguem ranking normal.

---

# Profissionais Novos

Definição:

Menos de:

* 30 dias
* 10 serviços

---

Recebem bônus de exposição.

---

# Sistema de Fila

Não enviar para todos.

---

MVP

Top 20 profissionais.

---

Somente os 20 melhores recebem.

---

# Lead Exclusivo

MVP

Primeiro que comprar leva.

---

Contato desbloqueado.

---

Lead removido da fila.

---

# Lead Compartilhado

V2

Até 3 profissionais.

---

# Lead Premium

Contratações fixas.

---

Maior prioridade.

---

Maior custo.

---

Mais exposição.

---

# Sistema de Escassez

Mostrar:

Profissionais elegíveis:

23

---

Leads restantes:

2

---

Objetivo:

Aumentar conversão.

---

# Notificações

Enviar:

Push

Email

Notificação interna

---

Exemplo

Novo Lead Disponível

Eletricista

3 km

Hoje

---

# Frequência

Evitar spam.

---

Máximo:

20 notificações por dia.

---

# Aprendizado Futuro

V3

Machine Learning.

---

Analisar:

* taxa de resposta
* taxa de compra
* taxa de contratação

---

Ajustar ranking automaticamente.

---

# Exclusões

Não enviar lead para:

* bloqueados
* suspensos
* inadimplentes
* contas suspeitas

---

# Métricas do Matching

Taxa de compra do lead

---

Tempo até compra

---

Taxa de contratação

---

Tempo de resposta

---

Receita por lead

---

Conversão por categoria

---

# Dashboard Admin

Exibir:

Top categorias

Top cidades

Profissionais mais ativos

Conversão por lead

Conversão por categoria

Ranking geral

---

# Segurança

Profissional nunca pode:

* alterar score
* alterar ranking
* alterar posição

---

Toda pontuação deve ser calculada no backend.

---

# Roadmap

V1

Matching por regras

---

V2

Matching por comportamento

---

V3

Matching por IA

---

V4

Matching preditivo

---

# Definição de Sucesso

O profissional deve sentir que recebe oportunidades relevantes.

O contratante deve sentir que encontra profissionais rapidamente.

O sistema deve distribuir oportunidades de forma justa, sustentável e lucrativa para a plataforma.
