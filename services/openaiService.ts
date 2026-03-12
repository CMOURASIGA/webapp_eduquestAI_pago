import { Exam, Question, SerieEscolar } from '../types/exam';
import { buildExamGenerationPrompt } from '../utils/examGenerationPromptBuilder';
import { extractJSON } from '../utils/parseAIResponse';
import { validateExam } from '../utils/validateExam';

function ensureUniqueIds(questions: Question[]) {
  questions.forEach((q, index) => {
    q.id = q.id || `q${index}`;
    q.alternativas = q.alternativas.map((alt, altIdx) => ({
      ...alt,
      id: alt.id || String.fromCharCode(65 + altIdx)
    }));
  });
}

export async function testOpenAIConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/openai/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
}

export async function generateExamWithOpenAI(params: GenerateParams): Promise<Partial<Exam>> {
  const prompt = buildExamGenerationPrompt(params);

  try {
    const response = await fetch('/api/openai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelName: params.modelName || 'gpt-4o-mini',
        prompt: prompt
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

    // A API da OpenAI pode retornar o JSON dentro de blocos de código markdown (```json ... ```)
    let jsonString = data.result;
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = extractJSON(jsonString);

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

    const questions = (parsed.questions as Question[]).map((q, idx) => {
      const alternativas = normalizeAlternativas((q as any).alternativas);

      const alternativaCorretaId =
        (q as any).alternativaCorretaId ||
        (q as any).alternativa_correta_id ||
        (q as any).corretaId;

      // Validação mínima: enunciado, pelo menos 2 alternativas e gabarito
      if (!q.enunciado || alternativas.length < 2 || !alternativaCorretaId) {
        throw new Error(`A IA retornou uma questão incompleta (questão ${idx + 1}). Tente gerar novamente com um conteúdo base diferente ou modelo diferente.`);
      }

      return {
        ...q,
        id: q.id || crypto.randomUUID(),
        alternativas,
        alternativaCorretaId,
      };
    });

    const examResult = {
      questions,
      createdAt: new Date().toISOString()
    };

    ensureUniqueIds(examResult.questions as Question[]);
    validateExam(examResult as any);

    return examResult;
  } catch (error: any) {
    console.error("Erro na chamada à OpenAI:", error);
    throw new Error(error.message || "Erro desconhecido ao gerar a prova.");
  }
}
