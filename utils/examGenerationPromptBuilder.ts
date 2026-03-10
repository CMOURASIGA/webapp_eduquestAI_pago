
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
1. Gere EXATAMENTE 10 questões de múltipla escolha.
2. Siga o estilo ENEM: enunciados contextualizados, interdisciplinares onde possível e foco em competências.
3. Cada questão deve ter exatamente 5 alternativas (A, B, C, D, E).
4. Apenas uma alternativa está correta.
5. Para cada questão, escreva uma "explicacao" detalhada que ajude o aluno a aprender o conceito por trás da resposta correta e por que as outras estão erradas (orientação de estudo).
6. Use linguagem e vocabulário adequados para a idade de ${age}.
7. Retorne o resultado estritamente no formato JSON solicitado.
8. Garanta que cada questão tenha um ID único.

Sua resposta deve ser um objeto JSON contendo uma lista de 'questions'.`;
};
