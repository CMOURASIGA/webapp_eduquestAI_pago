import { Exam, Question, SerieEscolar } from "../types/exam";
import { buildExamGenerationPrompt } from "../utils/examGenerationPromptBuilder";
import { validateExam } from "../utils/validateExam";

interface GenerateParams {
  serie: SerieEscolar;
  disciplina: string;
  objetivo: string;
  conteudoBase: string[];
  nivelDificuldade: "baixa" | "media" | "alta";
  modelName: string;
  apiKey?: string;
  authToken?: string;
}

export async function generateExamWithGemini(params: GenerateParams): Promise<Partial<Exam>> {
  const prompt = buildExamGenerationPrompt(params);
  const response = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.authToken ? { Authorization: `Bearer ${params.authToken}` } : {}),
    },
    body: JSON.stringify({
      modelName: params.modelName || 'gemini-2.5-flash',
      prompt,
      apiKey: params.apiKey,
      questionCount: 40,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const details = data?.reasons?.length ? ` Motivos: ${data.reasons.join(' | ')}` : '';
    throw new Error((data?.error || data?.details || 'Falha ao gerar com Gemini.') + details);
  }

  if (!data.result) {
    throw new Error('O Gemini retornou uma resposta vazia.');
  }

  const parsed = JSON.parse(data.result);
  const exam = {
    questions: (parsed.questions as Question[]).map((q) => ({
      ...q,
      id: q.id || crypto.randomUUID(),
    })),
    createdAt: new Date().toISOString(),
  };

  validateExam(exam as Pick<Exam, 'questions'>);
  return exam;
}
