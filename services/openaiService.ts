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

    const data = await response.json();

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
    
    return {
      questions: (parsed.questions as Question[]).map(q => ({
        ...q,
        id: q.id || crypto.randomUUID()
      })),
      createdAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Erro na chamada à OpenAI:", error);
    throw new Error(error.message || "Erro desconhecido ao gerar a prova.");
  }
}
