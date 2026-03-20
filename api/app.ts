import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import multer from "multer";
import { cleanExtractedText } from "../utils/cleanExtractedText.js";

dotenv.config();

export const app = express();
const PORT = 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/jpg"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de imagem não suportado. Use jpg, jpeg ou png."));
    }
  },
});

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

function appendLog(entry: any) {
  try {
    const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
    const logPath = path.resolve(process.cwd(), "logs", "examGeneration.log");
    fs.appendFileSync(logPath, logEntry, { encoding: "utf8" });
  } catch (e) {
    console.error("Falha ao gravar log de geração:", e);
  }
}

const answersFile = path.resolve(process.cwd(), "logs", "studentAnswers.json");
function readAnswers() {
  try {
    if (!fs.existsSync(answersFile)) return [];
    const raw = fs.readFileSync(answersFile, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.error("Falha ao ler answers:", e);
    return [];
  }
}
function writeAnswers(data: any[]) {
  try {
    fs.writeFileSync(answersFile, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Falha ao gravar answers:", e);
  }
}

// Health estendido: não expõe chaves, só indica se estão configuradas
app.get("/api/health/full", (req, res) => {
  res.json({
    status: "ok",
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    nodeEnv: process.env.NODE_ENV || "development",
    vercel: Boolean(process.env.VERCEL)
  });
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

    const { modelName, prompt, disciplina, conteudoBase } = req.body;

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

    appendLog({
      disciplina,
      conteudoBase,
      prompt,
      response: response.choices[0]?.message?.content
    });

    console.log("Resposta recebida da OpenAI com sucesso");
    res.json({ 
      success: true, 
      result: response.choices[0]?.message?.content 
    });
  } catch (error: any) {
    appendLog({
      error: true,
      details: error?.message,
      stack: error?.stack
    });
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

// OCR endpoint - extrai texto de imagem
app.post("/api/extract-text-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENAI_API_KEY não configurada para OCR." });
    }

    const buffer = req.file.buffer;
    const base64 = buffer.toString("base64");
    const openai = new OpenAI({ apiKey });

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia todo o texto legível desta imagem. Responda somente com o texto." },
            {
              type: "image_url",
              image_url: {
                url: `data:${req.file.mimetype};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const rawText = visionResponse.choices[0]?.message?.content || "";
    const cleaned = cleanExtractedText(rawText);

    if (!cleaned) {
      return res.status(400).json({ error: "Nenhum texto identificado na imagem." });
    }

    res.json({ text: cleaned });
  } catch (error: any) {
    console.error("Falha no OCR:", error);
    let message = "Não foi possível extrair o texto da imagem.";
    if (error?.message?.includes("File too large")) {
      message = "Imagem excede o tamanho permitido (5MB).";
    }
    res.status(500).json({ error: message, details: error?.message });
  }
});

// Persistência de respostas dos alunos
app.post("/api/answers", (req, res) => {
  try {
    const body = req.body;
    if (!body?.userId || !body?.examId || !Array.isArray(body?.answers)) {
      return res.status(400).json({ error: "Payload inválido para respostas." });
    }
    const existing = readAnswers();
    const records = body.answers.map((ans: any) => ({
      ...ans,
      userId: body.userId,
      examId: body.examId,
      disciplina: body.disciplina || ans.disciplina,
      createdAt: ans.createdAt || new Date().toISOString()
    }));
    existing.push(...records);
    writeAnswers(existing);
    res.json({ success: true, saved: records.length });
  } catch (e: any) {
    console.error("Falha ao salvar respostas:", e);
    res.status(500).json({ error: "Falha ao salvar respostas", details: e?.message });
  }
});

function calculatePerformance(records: any[]) {
  const byDiscipline: Record<string, { correct: number; total: number }> = {};
  records.forEach((r) => {
    if (!byDiscipline[r.disciplina]) byDiscipline[r.disciplina] = { correct: 0, total: 0 };
    byDiscipline[r.disciplina].total += 1;
    if (r.isCorrect) byDiscipline[r.disciplina].correct += 1;
  });
  const disciplines = Object.fromEntries(
    Object.entries(byDiscipline).map(([disc, val]) => [
      disc,
      {
        correct: val.correct,
        total: val.total,
        accuracy: val.total ? Math.round((val.correct / val.total) * 100) : 0,
      },
    ])
  );
  const totals = records.length;
  const correctTotal = records.filter((r) => r.isCorrect).length;
  const exams = Array.from(new Set(records.map((r) => r.examId))).length;
  return {
    disciplines,
    totals: {
      exams,
      questions: totals,
      accuracy: totals ? Math.round((correctTotal / totals) * 100) : 0,
    },
  };
}

// Desempenho por usuário
app.get("/api/performance/user/:userId", (req, res) => {
  try {
    const all = readAnswers();
    const userRecords = all.filter((r) => r.userId === req.params.userId);
    const perf = calculatePerformance(userRecords);
    res.json(perf);
  } catch (e: any) {
    console.error("Falha ao calcular desempenho do usuário:", e);
    res.status(500).json({ error: "Falha ao calcular desempenho", details: e?.message });
  }
});

// Resumo agregado (professor)
app.get("/api/performance/summary", (req, res) => {
  try {
    const all = readAnswers();
    const perf = calculatePerformance(all);
    res.json(perf);
  } catch (e: any) {
    console.error("Falha ao calcular desempenho agregado:", e);
    res.status(500).json({ error: "Falha ao calcular desempenho", details: e?.message });
  }
});

// Fallback de erros não tratados
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Erro não tratado no Express:", err);
  res.status(err?.status || 500).json({
    error: "Erro interno no servidor.",
    details: err?.message || "Unhandled error"
  });
});

export async function startServer() {
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
