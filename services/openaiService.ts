import { Exam, Question, SerieEscolar } from '../types/exam';
import { buildExamGenerationPrompt } from '../utils/examGenerationPromptBuilder';
import { extractJSON } from '../utils/parseAIResponse';
import { validateExam } from '../utils/validateExam';
import { QUESTIONS_PER_EXAM } from '../utils/examConfig';

function ensureUniqueIds(questions: Question[]) {
  questions.forEach((q, index) => {
    // Força ids previsíveis e únicos mesmo em geração por lotes
    q.id = `q${index + 1}`;
    q.alternativas = q.alternativas.map((alt, altIdx) => ({
      ...alt,
      id: alt.id || String.fromCharCode(65 + altIdx)
    }));
  });
}

function ensureOnTopic(questions: Question[], conteudoBase: string[]) {
  const text = (conteudoBase || []).join(' ').toLowerCase();
  const keywords = Array.from(
    new Set(
      text
        .split(/[^a-zà-úÀ-Ú0-9]+/i)
        .filter((w) => w && w.length >= 4)
    )
  ).slice(0, 30);

  if (keywords.length === 0) return;

  questions.forEach((q, idx) => {
    const en = (q.enunciado || '').toLowerCase();
    const hasKeyword = keywords.some((kw) => en.includes(kw));
    if (!hasKeyword) {
      console.warn(`Questão ${idx + 1} pode não mencionar diretamente o conteúdo base (sem palavra-chave detectada).`);
    }
  });
}

const normalizeAlternativas = (alts: any): Question["alternativas"] => {
  if (Array.isArray(alts)) {
    return alts.map((alt: any, idx: number) => {
      const texto =
        typeof alt === "string"
          ? alt
          : alt?.texto || alt?.text || "";
      return {
        id: (alt as any)?.id || crypto.randomUUID(),
        label: (alt as any)?.label || String.fromCharCode(65 + idx),
        texto
      };
    });
  }
  if (alts && typeof alts === "object") {
    return Object.entries(alts).map(([key, val]: any, idx: number) => {
      const texto =
        typeof val === "string"
          ? val
          : val?.texto || val?.text || "";
      return {
        id: val?.id || crypto.randomUUID(),
        label: val?.label || key || String.fromCharCode(65 + idx),
        texto
      };
    });
  }
  return [];
};

async function callOpenAIBatch(params: GenerateParams, offset: number, count: number): Promise<Question[]> {
  const prompt = buildExamGenerationPrompt({ ...params, questionsCount: count, questionOffset: offset });
  const response = await fetch('/api/openai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.authToken ? { Authorization: `Bearer ${params.authToken}` } : {}),
    },
    body: JSON.stringify({
      modelName: params.modelName || 'gpt-4o-mini',
      prompt: prompt,
      disciplina: params.disciplina,
      conteudoBase: params.conteudoBase,
      questionCount: count,
      questionOffset: offset
    })
  });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.error("Resposta não-JSON recebida:", text);
    throw new Error(`O servidor retornou uma resposta inesperada (não-JSON). Isso geralmente acontece por timeout ou erro interno no Vercel. Detalhes: ${text.substring(0, 100)}...`);
  }

  if (!response.ok) {
    throw new Error(data.error || data.details || 'Erro desconhecido ao gerar a prova com OpenAI.');
  }

  if (!data.result) {
    throw new Error("A OpenAI retornou uma resposta vazia.");
  }

  let jsonString = data.result;
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\n/, '').replace(/\n```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\n/, '').replace(/\n```$/, '');
  }

  const parsed = extractJSON(jsonString);
  const questions = (parsed.questions as Question[]).map((q, idx) => {
    const alternativas = normalizeAlternativas((q as any).alternativas);

    const alternativaCorretaId =
      (q as any).alternativaCorretaId ||
      (q as any).alternativa_correta_id ||
      (q as any).corretaId;

    if (!q.enunciado || alternativas.length < 2 || !alternativaCorretaId) {
      throw new Error(`A IA retornou uma questão incompleta (questão ${idx + 1 + offset}). Tente gerar novamente com um conteúdo base diferente ou modelo diferente.`);
    }

    return {
      ...q,
      id: q.id || crypto.randomUUID(),
      alternativas,
      alternativaCorretaId,
    };
  });

  return questions;
}

export async function testOpenAIConnection(authToken?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/openai/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || data.details || 'Erro desconhecido' };
    }

    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro de rede ao conectar com o backend.' };
  }
}

interface GenerateParams {
  serie: SerieEscolar;
  disciplina: string;
  objetivo: string;
  conteudoBase: string[];
  nivelDificuldade: "baixa" | "media" | "alta";
  modelName: string;
  authToken?: string;
}

export async function generateExamWithOpenAI(params: GenerateParams): Promise<Partial<Exam>> {
  try {
    const totalQuestions = QUESTIONS_PER_EXAM;
    // Lotes menores para reduzir tempo de cada chamada (Vercel timeout 60s)
    const batchSize = Math.min(8, Math.max(5, Math.ceil(totalQuestions / 5)));
    const batches: { offset: number; count: number }[] = [];
    for (let offset = 0; offset < totalQuestions; offset += batchSize) {
      batches.push({ offset, count: Math.min(batchSize, totalQuestions - offset) });
    }

    const allQuestions: Question[] = [];
    for (const b of batches) {
      const questions = await callOpenAIBatch(params, b.offset, b.count);
      allQuestions.push(...questions);
    }

    const examResult = {
      questions: allQuestions,
      createdAt: new Date().toISOString()
    };

    ensureOnTopic(examResult.questions as Question[], params.conteudoBase);
    ensureUniqueIds(examResult.questions as Question[]);
    validateExam(examResult as any);

    return examResult;
  } catch (error: any) {
    console.error("Falha na validação da prova gerada:", error);
    throw new Error(error.message || "Erro desconhecido ao gerar a prova.");
  }
}
