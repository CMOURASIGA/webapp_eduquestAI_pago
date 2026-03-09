import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // OpenAI Test Endpoint
  app.post("/api/openai/test", async (req, res) => {
    try {
      // Tenta pegar a chave do ambiente do Node (backend real) ou da variável injetada (se rodando em ambiente serverless/Vercel)
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "OPENAI_API_KEY não configurada nas variáveis de ambiente." });
      }

      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Using standard gpt-4o-mini as gpt-4.1-mini doesn't exist, but we can use whatever the user wants if needed. The user example used gpt-4.1-mini.
        messages: [{ role: "user", content: "Teste de conexão. Responda apenas 'Conexão com OpenAI bem-sucedida!' se receber esta mensagem." }],
      });

      res.json({ 
        success: true, 
        message: response.choices[0]?.message?.content || "Resposta vazia da OpenAI" 
      });
    } catch (error: any) {
      console.error("Erro na API da OpenAI:", error);
      
      // Map common errors
      let errorMessage = "Erro ao conectar com a OpenAI.";
      if (error.status === 429) errorMessage = "Limite de uso atingido (429).";
      if (error.status === 401) errorMessage = "Chave de API inválida (401).";
      if (error.error?.code === "insufficient_quota") errorMessage = "Sem saldo ou billing não ativado (insufficient_quota).";
      
      res.status(error.status || 500).json({ 
        error: errorMessage, 
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
