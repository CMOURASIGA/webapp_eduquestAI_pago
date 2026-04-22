<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b94c65fb-edc5-49b7-a2f7-e91531573aa4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env` (or `.env.local`) with:
   - `OPENAI_API_KEY` → chave usada pelo backend Express nos endpoints `/api/openai/*`
   - `API_KEY` → chave do Gemini usada no frontend
3. Run the app:
   `npm run dev`

## Billing mode (manual PIX)

- `PIX_PAYMENT_KEY` definido: checkout entra em modo real manual (`pix_manual`) e exibe chave PIX + identificador do pagamento.
- `PIX_PAYMENT_KEY` vazio: checkout permanece em modo teste com simulacao local.
- A liberacao de conta continua manual, respeitando `MIN_MANUAL_RELEASE_HOURS` (padrao: `1`).

## Smoke test operacional

- Execute `npm run test:smoke-billing` para validar: cadastro, login, status da conta, listagem de planos e criacao de checkout.
- Em ambiente com Google Sheets ativo, o backend usa as abas `auth_users` e `auth_sessions` para persistir login/sessao (evita perda de login por reinicio no Vercel).
