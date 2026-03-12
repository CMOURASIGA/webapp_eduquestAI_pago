import { Exam, Question, SerieEscolar } from '../types/exam';
import { buildExamGenerationPrompt } from '../utils/examGenerationPromptBuilder';

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

    const parsed = JSON.parse(jsonString);

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

    return {
      questions: (parsed.questions as Question[]).map((q, idx) => {
        const alternativas = normalizeAlternativas((q as any).alternativas);
        const filledAlternativas = alternativas.length
          ? alternativas
          : Array.from({ length: 5 }).map((_, i) => ({
              id: crypto.randomUUID(),
              label: String.fromCharCode(65 + i),
              texto: `Alternativa ${String.fromCharCode(65 + i)}`
            }));

        const alternativaCorretaId =
          (q as any).alternativaCorretaId ||
          (q as any).alternativa_correta_id ||
          (q as any).corretaId ||
          filledAlternativas[0]?.id;

        return {
          ...q,
          id: q.id || crypto.randomUUID(),
          enunciado: q.enunciado || q["enunciado"] || `Questão ${idx + 1}: enunciado não retornado pela IA.`,
          explicacao: q.explicacao || `Sem explicação retornada pela IA.`,
          alternativas: filledAlternativas,
          alternativaCorretaId,
        };
      }),
      createdAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Erro na chamada à OpenAI:", error);
    throw new Error(error.message || "Erro desconhecido ao gerar a prova.");
  }
}
