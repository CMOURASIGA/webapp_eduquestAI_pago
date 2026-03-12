
import { SerieEscolar } from '../types/exam';
import { serieLabels, getAgeRange } from './seriesUtils';

interface PromptParams {
  serie: SerieEscolar;
  disciplina: string;
  objetivo: string;
  conteudoBase: string[];
  nivelDificuldade: "baixa" | "media" | "alta";
}

export const buildExamGenerationPrompt = (params: PromptParams): string => {
  const { serie, disciplina, objetivo, conteudoBase, nivelDificuldade } = params;
  const label = serieLabels[serie];
  const age = getAgeRange(serie);

  return `Aja como um professor especialista brasileiro criando uma prova de ESTUDO para alunos do ${label} (faixa etária aproximada: ${age}).
A disciplina é "${disciplina}".
O objetivo pedagógico é: "${objetivo}".
Nível de dificuldade desejado: ${nivelDificuldade}.

USE O SEGUINTE CONTEÚDO BASE COMO REFERÊNCIA PRINCIPAL:
---
${conteudoBase.join('\n\n')}
---

INSTRUÇÕES IMPORTANTES:
1. Gere EXATAMENTE 5 questões de múltipla escolha.
2. Siga o estilo ENEM: enunciados contextualizados, interdisciplinares onde possível e foco em competências.
3. Cada questão deve ter exatamente 5 alternativas (A, B, C, D, E).
4. Apenas uma alternativa está correta.
5. Para cada questão, escreva uma "explicacao" detalhada que ajude o aluno a aprender o conceito por trás da resposta correta e por que as outras estão erradas (orientação de estudo).
6. Use linguagem e vocabulário adequados para a idade de ${age}.
7. Retorne SOMENTE JSON válido. NÃO inclua texto antes ou depois do JSON.
8. Use exatamente este formato de resposta:
{
  "questions": [
    {
      "id": "string",
      "enunciado": "string",
      "alternativas": [
        { "id": "A", "texto": "string" },
        { "id": "B", "texto": "string" },
        { "id": "C", "texto": "string" },
        { "id": "D", "texto": "string" },
        { "id": "E", "texto": "string" }
      ],
      "alternativaCorretaId": "A",
      "explicacao": "string"
    }
  ]
}
9. Garanta que cada questão tenha um ID único.

Sua resposta deve ser estritamente um objeto JSON contendo uma lista de 'questions'.`;
};
