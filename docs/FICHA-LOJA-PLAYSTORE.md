# Ficha da loja — Google Play (FazTudo) — respostas prontas

> Cole/selecione estas respostas no Play Console quando a verificação de
> identidade for aprovada. Os textos da listagem (descrição curta/completa),
> ícone 512 e capa 1024×500 já estão prontos (ver chat / pasta design-system/play-store).

## Identidade do app
- **Nome:** FazTudo
- **Idioma padrão:** Português (Brasil)
- **App ou jogo:** App
- **Gratuito ou pago:** Gratuito (com compras no app — créditos)
- **Categoria:** Estilo de vida (alternativa: Negócios)
- **E-mail de contato:** sispeedsistemas@gmail.com
- **Site:** https://faztudoapp.com.br
- **Política de privacidade:** https://faztudoapp.com.br/politica-de-privacidade
- **URL de exclusão de conta:** https://faztudoapp.com.br/excluir-conta

## Público-alvo e conteúdo
- **Faixa etária alvo:** 18 anos ou mais (o serviço exige maioridade).
- **App direcionado a crianças?** Não.

## Classificação de conteúdo (questionário IARC)
- Violência / sexo / drogas / linguagem imprópria / jogos de azar: **Não** para todos.
- **O app permite interação/comunicação entre usuários?** Sim (chat).
- **Compartilha localização do usuário com outros?** Não (a localização é usada
  para casar pedido↔profissional e comprovar comparecimento; não é exibida a outros).
- **Conteúdo gerado por usuário (UGC)?** Sim (pedidos, avaliações, mensagens) →
  há mecanismo de **denúncia** e **moderação** (admin). 
- Resultado esperado: **Livre / 12** (a comunicação entre usuários pode elevar a faixa).

## Segurança dos dados (Data safety) — respostas

**O app coleta ou compartilha dados?** Sim, coleta.
**Dados criptografados em trânsito?** Sim (HTTPS/TLS).
**O usuário pode solicitar a exclusão dos dados?** Sim (in-app: Perfil → Excluir
minha conta; e web: /excluir-conta).

Tipos de dados coletados (marque "Coletado"; nenhum é vendido):

| Categoria | Dado | Finalidade | Compartilhado? |
|---|---|---|---|
| Informações pessoais | Nome | Funcionalidade do app, conta | Não |
| Informações pessoais | E-mail | Conta, comunicação | Não |
| Informações pessoais | Telefone | Funcionalidade (contato do serviço) | Não |
| Informações pessoais | Endereço (cidade/estado) | Casar pedido↔profissional | Não |
| Informações pessoais | Documento (CPF/CNPJ) | Verificação de identidade (KYC) | Não |
| Informações pessoais | Gênero, data de nascimento | Cadastro/métricas internas | Não |
| Localização | Localização aproximada/precisa | Casar pedido e comprovar comparecimento | Não |
| Fotos | Fotos (perfil, pedido, chat, documento/selfie KYC) | Funcionalidade, verificação | Não |
| Informações financeiras | Pagamentos | Processados pelo Mercado Pago | Sim, com o processador (Mercado Pago) |
| Mensagens | Mensagens no app (chat) | Comunicação entre as partes | Não |
| Atividade no app | Páginas/uso (analytics interno) | Análise e melhoria | Não |
| ID do dispositivo | Inscrição de push | Notificações | Não |

> Observação: dados de **pagamento** (cartão/Pix) são tratados pelo **Mercado
> Pago**; o app não armazena dados de cartão.

## Permissões do app (e justificativa)
- **Internet / estado da rede** — comunicação com o servidor.
- **Câmera** — enviar foto do pedido, selfie do KYC, foto no chat.
- **Localização (aproximada/precisa)** — casar pedido por região e comprovar
  comparecimento (anti-calote).
- **Notificações (POST_NOTIFICATIONS)** — avisar de novas oportunidades/mensagens.
- Sem SMS, contatos, microfone, armazenamento amplo.

## Capturas de tela (você tira do celular — mín. 2, ideal 4–6)
Telas sugeridas, com o app novo instalado:
1. Início (categorias) · 2. Nova solicitação · 3. Oportunidade/detalhe ·
4. Chat · 5. Perfil com avaliações · 6. Créditos.

## Conteúdo já pronto (não precisa refazer)
- Descrição curta + completa (PT-BR) — ver chat / repo.
- `design-system/play-store/icon-512.png` e `feature-1024x500.png`.

---

### ⚠️ Pendências do dono (manuais, fora do código)
- Submeter estas respostas no Play Console **após a verificação de identidade**.
- Tirar e subir as capturas de tela.
- Confirmar o telefone de contato (libera após a verificação).
