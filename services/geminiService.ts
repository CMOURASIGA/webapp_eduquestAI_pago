
import { GoogleGenAI, Type } from "@google/genai";
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
}

export async function generateExamWithGemini(params: GenerateParams): Promise<Partial<Exam>> {
  // A chave de API deve estar disponível em process.env.API_KEY.
  // Criamos a instância aqui para garantir o uso da chave injetada no ambiente.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY não encontrada no ambiente. Verifique as configurações da Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildExamGenerationPrompt(params);

  try {
    const response = await ai.models.generateContent({
      model: params.modelName || 'gemini-3-flash-preview',
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
                      },
                      required: ["id", "label", "texto"]
                    }
                  },
                  alternativaCorretaId: { type: Type.STRING },
                  explicacao: { type: Type.STRING },
                  competenciaOuHabilidade: { type: Type.STRING }
                },
                required: ["id", "enunciado", "alternativas", "alternativaCorretaId", "explicacao"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("O Gemini retornou uma resposta vazia.");
    }

    const parsed = JSON.parse(resultText);
    const exam = {
      questions: (parsed.questions as Question[]).map(q => ({
        ...q,
        id: q.id || crypto.randomUUID()
      })),
      createdAt: new Date().toISOString()
    };

    validateExam(exam as Pick<Exam, 'questions'>);
    return exam;
  } catch (error: any) {
    console.error("Erro na chamada ao Gemini:", error);
    throw new Error(error.message || "Erro desconhecido ao gerar a prova.");
  }
}
