import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

dotenv.config();

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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENAI_API_KEY não configurada nas variáveis de ambiente." });
    }

    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Teste de conexão. Responda apenas 'Conexão com OpenAI bem-sucedida!' se receber esta mensagem." }],
    });

    res.json({ 
      success: true, 
      message: response.choices[0]?.message?.content || "Resposta vazia da OpenAI" 
    });
  } catch (error: any) {
    console.error("Erro na API da OpenAI:", error);
    
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

// OpenAI Generate Exam Endpoint
app.post("/api/openai/generate", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENAI_API_KEY não configurada nas variáveis de ambiente." });
    }

    const { modelName, prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "O prompt é obrigatório." });
    }

    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: modelName || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    res.json({ 
      success: true, 
      result: response.choices[0]?.message?.content 
    });
  } catch (error: any) {
    console.error("Erro na API da OpenAI (Generate):", error);
    
    let errorMessage = "Erro ao gerar a prova com a OpenAI.";
    if (error.status === 429) errorMessage = "Limite de uso atingido (429).";
    if (error.status === 401) errorMessage = "Chave de API inválida (401).";
    if (error.error?.code === "insufficient_quota") errorMessage = "Sem saldo ou billing não ativado (insufficient_quota).";
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: error.message 
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Only listen if not running as a serverless function
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
