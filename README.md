# EduQuest IA

Aplicacao para geracao de provas com controle de acesso, planos e creditos.

## Requisitos

- Node.js
- OPENAI_API_KEY configurada

## Rodar localmente

1. Instale dependencias:
   `npm install`
2. Crie `.env` com:
   - `OPENAI_API_KEY` -> chave central da OpenAI (backend)
   - `GOOGLE_SHEET_ID` e `GOOGLE_SERVICE_ACCOUNT_JSON` (opcional, para persistencia em planilha)
   - `PIX_PAYMENT_KEY` (opcional, para modo PIX manual)
3. Execute:
   `npm run dev`

## Regras principais atuais

- Geracao de prova usa somente OpenAI.
- Acesso gratuito inicial: uma vez por identidade (email/telefone).
- Cancelamento de checkout pendente e cancelamento de conta disponiveis no sistema.
- Eventos de conta e cancelamento registrados na aba `eventos_conta` da planilha.
- Conta principal pode criar subcadastros de aluno (usuario/senha) em Configuracoes.

## Variaveis importantes

- `OPENAI_API_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `MIN_MANUAL_RELEASE_HOURS`
- `DEFAULT_QUESTIONS_PER_EXAM`
- `FREE_ONCE_PLAN_ID`, `FREE_ONCE_CREDITS`, `FREE_ONCE_VALIDITY_DAYS`
- `PIX_PAYMENT_KEY`, `PIX_PAYMENT_RECIPIENT`

## Smoke test operacional

Execute:
`npm run test:smoke-billing`

O teste valida cadastro, login, acesso gratuito unico, listagem de planos e criacao de checkout.
