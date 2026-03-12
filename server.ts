import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
// Aumenta limite do body para permitir prompts maiores e evita 413 HTML
app.use(express.json({ limit: "2mb" }));
// Retorna erros de parsing em JSON estruturado
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload muito grande",
      details: "O conteúdo enviado excede o limite de 2MB. Envie um texto menor."
    });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({
      error: "JSON inválido",
      details: err.message
    });
  }
  return next(err);
});

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
  console.log("Recebida requisição para /api/openai/generate");
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY não encontrada");
      return res.status(401).json({ error: "OPENAI_API_KEY não configurada nas variáveis de ambiente." });
    }

    const { modelName, prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "O prompt é obrigatório." });
    }

    console.log(`Iniciando chamada OpenAI com modelo: ${modelName || "gpt-4o-mini"}`);
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: modelName || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    console.log("Resposta recebida da OpenAI com sucesso");
    res.json({ 
      success: true, 
      result: response.choices[0]?.message?.content 
    });
  } catch (error: any) {
    console.error("Erro detalhado na API da OpenAI (Generate):", error);
    
    let errorMessage = "Erro ao gerar a prova com a OpenAI.";
    if (error.status === 429) errorMessage = "Limite de uso atingido (429).";
    if (error.status === 401) errorMessage = "Chave de API inválida (401).";
    if (error.error?.code === "insufficient_quota") errorMessage = "Sem saldo ou billing não ativado (insufficient_quota).";
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

async function startServer() {
  const isVercel = Boolean(process.env.VERCEL);
  const isProduction = process.env.NODE_ENV === "production" || isVercel;

  // Vite middleware apenas no dev local
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite not found, skipping middleware (this is normal in production)");
    }
  }

  // Only listen if not running as a serverless function
  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
