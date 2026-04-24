import { Exam, Question, SerieEscolar } from '../types/exam';
import { buildExamGenerationPrompt } from '../utils/examGenerationPromptBuilder';
import { extractJSON } from '../utils/parseAIResponse';
import { validateExam } from '../utils/validateExam';
import { QUESTIONS_PER_EXAM } from '../utils/examConfig';

function ensureUniqueIds(questions: Question[]) {
  questions.forEach((q, index) => {
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
        .split(/[^a-z\u00e0-\u00fa\u00c0-\u00da0-9]+/i)
        .filter((w) => w && w.length >= 4)
    )
  ).slice(0, 30);

  if (keywords.length === 0) return;

  questions.forEach((q, idx) => {
    const en = (q.enunciado || '').toLowerCase();
    const hasKeyword = keywords.some((kw) => en.includes(kw));
    if (!hasKeyword) {
      console.warn(`Questao ${idx + 1} pode nao mencionar diretamente o conteudo base (sem palavra-chave detectada).`);
    }
  });
}

const normalizeAlternativas = (alts: any): Question['alternativas'] => {
  if (Array.isArray(alts)) {
    return alts.map((alt: any, idx: number) => {
      const fallbackLabel = String.fromCharCode(65 + idx);
      const texto =
        typeof alt === 'string'
          ? alt
          : alt?.texto || alt?.text || '';
      const normalizedText = String(texto || '').trim();
      return {
        id: (alt as any)?.id || (alt as any)?.label || fallbackLabel,
        label: (alt as any)?.label || fallbackLabel,
        texto: normalizedText
      };
    });
  }
  if (alts && typeof alts === 'object') {
    return Object.entries(alts).map(([key, val]: any, idx: number) => {
      const fallbackLabel = String.fromCharCode(65 + idx);
      const texto =
        typeof val === 'string'
          ? val
          : val?.texto || val?.text || '';
      const normalizedText = String(texto || '').trim();
      return {
        id: val?.id || val?.label || key || fallbackLabel,
        label: val?.label || key || fallbackLabel,
        texto: normalizedText
      };
    });
  }
  return [];
};

const ensureFiveAlternativas = (alternativas: Question['alternativas']): Question['alternativas'] => {
  const labels = ['A', 'B', 'C', 'D', 'E'];
  return labels.map((label, idx) => {
    const source = alternativas[idx] as any;
    const texto = String(source?.texto || '').trim();
    return {
      id: String(source?.id || source?.label || label),
      label,
      texto: texto || `Opcao ${label}`
    };
  });
};

const resolveCorretaId = (
  alternativaCorretaIdRaw: any,
  alternativas: Question['alternativas']
) => {
  const requested = String(alternativaCorretaIdRaw || '').trim();
  if (!requested) return alternativas[0]?.id || 'A';
  const byId = alternativas.find((a) => a.id === requested);
  if (byId) return byId.id;
  const byLabel = alternativas.find((a) => String(a.label || '').toUpperCase() === requested.toUpperCase());
  if (byLabel) return byLabel.id;
  return alternativas[0]?.id || 'A';
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(headerValue: string | null) {
  if (!headerValue) return 0;
  const asNumber = Number(headerValue);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber * 1000;
  const asDate = new Date(headerValue).getTime();
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return 0;
}

async function callOpenAIBatch(params: GenerateParams, offset: number, count: number): Promise<Question[]> {
  const prompt = buildExamGenerationPrompt({ ...params, questionsCount: count, questionOffset: offset });
  const maxAttempts = 5;
  let data: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch('/api/openai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.authToken ? { Authorization: `Bearer ${params.authToken}` } : {}),
      },
      body: JSON.stringify({
        modelName: params.modelName || 'gpt-4o-mini',
        prompt,
        disciplina: params.disciplina,
        conteudoBase: params.conteudoBase,
        questionCount: count,
        questionOffset: offset
      })
    });

    const contentType = response.headers.get('content-type') || '';
    let nonJsonBody = '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      nonJsonBody = await response.text();
      data = { error: 'Resposta inesperada do servidor.', details: nonJsonBody.slice(0, 240) };
    }

    if (response.ok) break;

    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (retryable && attempt < maxAttempts) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const backoffMs = retryAfterMs || (1200 * Math.pow(2, attempt - 1));
      await sleep(backoffMs);
      continue;
    }

    if (response.status === 429) {
      throw new Error('Limite temporario de requisicoes (429). Aguarde alguns segundos e tente novamente.');
    }
    if (!contentType.includes('application/json')) {
      throw new Error(`Servidor retornou ${response.status} em formato nao-JSON. Detalhes: ${nonJsonBody.slice(0, 120)}...`);
    }
    throw new Error(data?.error || data?.details || 'Erro desconhecido ao gerar a prova com OpenAI.');
  }

  if (!data?.result) {
    throw new Error('A OpenAI retornou uma resposta vazia.');
  }

  let jsonString = data.result;
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\n/, '').replace(/\n```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\n/, '').replace(/\n```$/, '');
  }

  const parsed = extractJSON(jsonString);
  const questions = (parsed.questions as Question[]).map((q, idx) => {
    const alternativas = ensureFiveAlternativas(normalizeAlternativas((q as any).alternativas));

    const alternativaCorretaIdRaw =
      (q as any).alternativaCorretaId ||
      (q as any).alternativa_correta_id ||
      (q as any).corretaId;
    const alternativaCorretaId = resolveCorretaId(alternativaCorretaIdRaw, alternativas);

    if (!q.enunciado || alternativas.length < 2 || !alternativaCorretaId) {
      throw new Error(`A IA retornou uma questao incompleta (questao ${idx + 1 + offset}). Tente gerar novamente.`);
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
  nivelDificuldade: 'baixa' | 'media' | 'alta';
  modelName: string;
  authToken?: string;
  questionCount?: number;
}

function extractInvalidQuestionIndex(message: string) {
  const match = String(message || '').match(/Questao\s+(\d+)\s+invalida/i);
  if (!match) return -1;
  const oneBased = Number(match[1]);
  if (!Number.isFinite(oneBased) || oneBased <= 0) return -1;
  return oneBased - 1;
}

export async function generateExamWithOpenAI(params: GenerateParams): Promise<Partial<Exam>> {
  try {
    const totalQuestions = Math.max(1, Number(params.questionCount || QUESTIONS_PER_EXAM));
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

    const maxRepairAttempts = 4;
    for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
      ensureOnTopic(examResult.questions as Question[], params.conteudoBase);
      ensureUniqueIds(examResult.questions as Question[]);
      try {
        validateExam(examResult as any);
        return examResult;
      } catch (validationError: any) {
        const message = String(validationError?.message || validationError || '');
        const invalidIdx = extractInvalidQuestionIndex(message);
        if (invalidIdx < 0 || invalidIdx >= examResult.questions.length || attempt >= maxRepairAttempts) {
          throw validationError;
        }
        console.warn(`Questao invalida detectada (idx=${invalidIdx}). Regenerando somente essa questao...`);
        const regenerated = await callOpenAIBatch(params, invalidIdx, 1);
        if (!regenerated || regenerated.length === 0) {
          throw validationError;
        }
        examResult.questions[invalidIdx] = regenerated[0];
      }
    }

    throw new Error('Falha inesperada ao validar prova gerada.');
  } catch (error: any) {
    console.error('Falha na validacao da prova gerada:', error);
    throw new Error(error.message || 'Erro desconhecido ao gerar a prova.');
  }
}
