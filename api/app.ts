import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { cleanExtractedText } from "../utils/cleanExtractedText.js";
import {
  registerAccessControlRoutes,
  requireAuth,
  requireCanGenerate,
  applyConsumption,
  type AuthenticatedRequest,
  getAuthFromRequest
} from "./accessControl.js";

dotenv.config();

export const app = express();
const PORT = 3000;
const WRITABLE_ROOT = process.env.VERCEL ? "/tmp" : process.cwd();
const LOGS_DIR = path.resolve(WRITABLE_ROOT, "logs");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/jpg"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de imagem nao suportado. Use jpg, jpeg ou png."));
    }
  },
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload muito grande",
      details: "O conteudo enviado excede o limite de 2MB. Envie um texto menor."
    });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({
      error: "JSON invalido",
      details: err.message
    });
  }
  return next(err);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

registerAccessControlRoutes(app);

function appendLog(entry: any) {
  try {
    const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
    const logPath = path.resolve(LOGS_DIR, "examGeneration.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, logEntry, { encoding: "utf8" });
  } catch (e) {
    console.error("Falha ao gravar log de geracao:", e);
  }
}

const answersFile = path.resolve(LOGS_DIR, "studentAnswers.json");
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
    fs.mkdirSync(path.dirname(answersFile), { recursive: true });
    fs.writeFileSync(answersFile, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Falha ao gravar answers:", e);
  }
}

app.get("/api/health/full", (_req, res) => {
  res.json({
    status: "ok",
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    geminiKeyPresent: Boolean(process.env.API_KEY),
    nodeEnv: process.env.NODE_ENV || "development",
    vercel: Boolean(process.env.VERCEL)
  });
});

app.post("/api/openai/test", requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENAI_API_KEY nao configurada nas variaveis de ambiente." });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Teste de conexao. Responda apenas: Conexao com OpenAI bem-sucedida!" }],
    });

    res.json({
      success: true,
      message: response.choices[0]?.message?.content || "Resposta vazia da OpenAI"
    });
  } catch (error: any) {
    console.error("Erro na API da OpenAI:", error);
    res.status(error.status || 500).json({
      error: "Erro ao conectar com a OpenAI.",
      details: error.message
    });
  }
});

app.post("/api/gemini/test", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = req.body?.apiKey || process.env.API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "API_KEY (Gemini) nao configurada." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: req.body?.modelName || "gemini-2.5-flash",
      contents: "Responda apenas: Conexao com Gemini bem-sucedida!"
    });

    return res.json({ success: true, message: response.text || "Resposta vazia do Gemini" });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao testar Gemini.", details: error?.message });
  }
});

app.post("/api/openai/generate", requireAuth, requireCanGenerate, async (req: AuthenticatedRequest, res) => {
  console.log("Recebida requisicao para /api/openai/generate");
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENAI_API_KEY nao configurada nas variaveis de ambiente." });
    }

    const { modelName, prompt, disciplina, conteudoBase, questionCount } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "O prompt e obrigatorio." });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: modelName || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    appendLog({
      auth: getAuthFromRequest(req),
      provider: "openai",
      disciplina,
      conteudoBase,
      prompt,
      response: response.choices[0]?.message?.content
    });

    if (req.authUser?.email) {
      await applyConsumption({
        userEmail: req.authUser.email,
        modelName: modelName || "gpt-4o-mini",
        questionCount: Number(questionCount || 1),
        statusExecucao: "sucesso",
        referencia: "openai_generate"
      });
    }

    return res.json({
      success: true,
      result: response.choices[0]?.message?.content
    });
  } catch (error: any) {
    appendLog({
      error: true,
      auth: getAuthFromRequest(req),
      provider: "openai",
      details: error?.message,
      stack: error?.stack
    });

    return res.status(error.status || 500).json({
      error: "Erro ao gerar a prova com a OpenAI.",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

app.post("/api/gemini/generate", requireAuth, requireCanGenerate, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = req.body?.apiKey || process.env.API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "API_KEY (Gemini) nao configurada." });
    }

    const { modelName, prompt, questionCount } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "O prompt e obrigatorio." });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName || "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  enunciado: { type: Type.STRING },
                  alternativas: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        texto: { type: Type.STRING }
                      }
                    }
                  },
                  alternativaCorretaId: { type: Type.STRING },
                  explicacao: { type: Type.STRING }
                },
                required: ["id", "enunciado", "alternativas", "alternativaCorretaId", "explicacao"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    appendLog({
      auth: getAuthFromRequest(req),
      provider: "gemini",
      prompt,
      response: response.text
    });

    if (req.authUser?.email) {
      await applyConsumption({
        userEmail: req.authUser.email,
        modelName: modelName || "gemini-2.5-flash",
        questionCount: Number(questionCount || 1),
        statusExecucao: "sucesso",
        referencia: "gemini_generate"
      });
    }

    return res.json({ success: true, result: response.text });
  } catch (error: any) {
    appendLog({
      error: true,
      auth: getAuthFromRequest(req),
      provider: "gemini",
      details: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      error: "Erro ao gerar prova com Gemini.",
      details: error?.message,
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
    });
  }
});

app.post("/api/extract-text-image", upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENAI_API_KEY nao configurada para OCR." });
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
            { type: "text", text: "Extraia todo o texto legivel desta imagem. Responda somente com o texto." },
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
    let message = "Nao foi possivel extrair o texto da imagem.";
    if (error?.message?.includes("File too large")) {
      message = "Imagem excede o tamanho permitido (5MB).";
    }
    res.status(500).json({ error: message, details: error?.message });
  }
});

app.post("/api/answers", (req, res) => {
  try {
    const body = req.body;
    if (!body?.userId || !body?.examId || !Array.isArray(body?.answers)) {
      return res.status(400).json({ error: "Payload invalido para respostas." });
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

app.get("/api/performance/user/:userId", (req, res) => {
  try {
    const all = readAnswers();
    const userRecords = all.filter((r) => r.userId === req.params.userId);
    const perf = calculatePerformance(userRecords);
    res.json(perf);
  } catch (e: any) {
    console.error("Falha ao calcular desempenho do usuario:", e);
    res.status(500).json({ error: "Falha ao calcular desempenho", details: e?.message });
  }
});

app.get("/api/performance/summary", (_req, res) => {
  try {
    const all = readAnswers();
    const perf = calculatePerformance(all);
    res.json(perf);
  } catch (e: any) {
    console.error("Falha ao calcular desempenho agregado:", e);
    res.status(500).json({ error: "Falha ao calcular desempenho", details: e?.message });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Erro nao tratado no Express:", err);
  res.status(err?.status || 500).json({
    error: "Erro interno no servidor.",
    details: err?.message || "Unhandled error"
  });
});

export async function startServer() {
  const isVercel = Boolean(process.env.VERCEL);
  const isProduction = process.env.NODE_ENV === "production" || isVercel;

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (_e) {
      console.warn("Vite not found, skipping middleware (normal in production)");
    }
  }

  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
