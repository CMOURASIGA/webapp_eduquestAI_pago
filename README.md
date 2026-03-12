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
