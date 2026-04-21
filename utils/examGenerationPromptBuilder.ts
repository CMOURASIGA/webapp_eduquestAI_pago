import { SerieEscolar } from '../types/exam';
import { serieLabels, getAgeRange } from './seriesUtils';
import { QUESTIONS_PER_EXAM } from './examConfig';

interface PromptParams {
  serie: SerieEscolar;
  disciplina: string;
  objetivo: string;
  conteudoBase: string[];
  nivelDificuldade: "baixa" | "media" | "alta";
  // Opcional para geracao em lotes: quantas questoes gerar e a partir de qual indice.
  questionsCount?: number;
  questionOffset?: number;
}

export const buildExamGenerationPrompt = (params: PromptParams): string => {
  const { serie, disciplina, objetivo, conteudoBase, nivelDificuldade } = params;
  const label = serieLabels[serie];
  const age = getAgeRange(serie);
  const questionsToGenerate = params.questionsCount ?? QUESTIONS_PER_EXAM;
  const questionOffset = params.questionOffset ?? 0;
  const startNumber = questionOffset + 1;
  const endNumber = questionOffset + questionsToGenerate;

  return `Aja como um professor especialista brasileiro criando uma prova de ESTUDO para alunos do ${label} (faixa etaria aproximada: ${age}).
A disciplina e "${disciplina}".
O objetivo pedagogico e: "${objetivo}".
Nivel de dificuldade desejado: ${nivelDificuldade}.

USE O SEGUINTE CONTEUDO BASE COMO REFERENCIA PRINCIPAL:
---
${conteudoBase.join('\n\n')}
---

INSTRUCOES IMPORTANTES:
1. Gere EXATAMENTE ${questionsToGenerate} questoes de multipla escolha.
1.1. Numere e identifique este lote de questoes de ${startNumber} ate ${endNumber} (ex.: q${startNumber}, q${startNumber + 1}, ...). Evite repetir questoes ja criadas em outros lotes.
2. Siga o estilo ENEM: enunciados contextualizados, interdisciplinares onde possivel e foco em competencias.
3. Cada questao deve ter exatamente 5 alternativas (A, B, C, D, E).
4. Apenas uma alternativa esta correta.
5. Regra critica de qualidade: NAO gere questao com resposta errada, ambigua, desatualizada ou com mais de uma alternativa possivelmente correta.
6. Antes de devolver o JSON final, valide CADA questao internamente (checklist silencioso):
   - existe UMA UNICA alternativa correta;
   - as outras 4 alternativas estao objetivamente incorretas;
   - enunciado e gabarito estao coerentes entre si;
   - nao ha dupla interpretacao de gabarito.
   Se qualquer item falhar, reescreva a questao antes de responder.
7. Para cada questao, escreva uma "explicacao" detalhada que ajude o aluno a aprender o conceito por tras da resposta correta e por que as outras estao erradas (orientacao de estudo).
8. Estruture a explicacao neste formato:
   "Correta: <letra> - <justificativa>. Incorretas: A - <motivo>; B - <motivo>; C - <motivo>; D - <motivo>; E - <motivo>."
   (A alternativa correta tambem deve aparecer na parte Incorretas com a indicacao de que e a correta.)
9. Use linguagem e vocabulario adequados para a idade de ${age}.
10. Ajuste o nivel de dificuldade conforme pedido: "baixa" = perguntas diretas e objetivas; "media" = foco em interpretacao de contexto; "alta" = raciocinio e aplicacao do conhecimento em situacoes mais complexas.
11. Retorne SOMENTE JSON valido. NAO inclua texto antes ou depois do JSON.
12. Use exatamente este formato de resposta:
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
13. Garanta que cada questao tenha um ID unico.
14. A explicacao deve: (a) justificar claramente por que a alternativa correta e correta; (b) apontar por que cada alternativa incorreta esta errada; (c) usar linguagem e exemplos adequados para a serie escolar.

Sua resposta deve ser estritamente um objeto JSON contendo uma lista de 'questions'.`;
};
