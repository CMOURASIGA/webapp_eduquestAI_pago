import { Exam } from '../types/exam';
import { QUESTIONS_PER_EXAM } from './examConfig';

// Validacao para garantir consistencia estrutural e pedagogica minima da prova.
export function validateExam(exam: Pick<Exam, 'questions'>) {
  if (!exam.questions || exam.questions.length !== QUESTIONS_PER_EXAM) {
    throw new Error(`Prova invalida: deve conter ${QUESTIONS_PER_EXAM} questoes.`);
  }

  exam.questions.forEach((q, idx) => {
    const expectedLabels = ['A', 'B', 'C', 'D', 'E'];

    if (!q.enunciado || q.enunciado.trim().length < 15) {
      throw new Error(`Questao ${idx + 1} invalida: enunciado insuficiente.`);
    }

    if (!q.alternativas || q.alternativas.length !== 5) {
      throw new Error(`Questao ${idx + 1} invalida: deve conter 5 alternativas.`);
    }

    // Sanitiza alternativas para evitar falha por resposta incompleta da IA.
    const oldAlternativas = q.alternativas.map((a) => ({
      id: String(a.id || '').trim(),
      label: String(a.label || '').trim().toUpperCase(),
      texto: String(a.texto || '').trim()
    }));
    const requestedCorreta = String(q.alternativaCorretaId || '').trim();
    q.alternativas = expectedLabels.map((label, altIdx) => {
      const src = oldAlternativas[altIdx] || { id: '', label: '', texto: '' };
      return {
        ...q.alternativas[altIdx],
        id: label,
        label,
        texto: src.texto || `Opcao ${label}`
      };
    });

    const indexByOriginalId = oldAlternativas.findIndex((a) => a.id && a.id === requestedCorreta);
    const indexByOriginalLabel = oldAlternativas.findIndex((a) => a.label && a.label === requestedCorreta.toUpperCase());
    const indexByRequestedLabel = expectedLabels.indexOf(requestedCorreta.toUpperCase());
    const chosenIndex =
      indexByOriginalId >= 0 ? indexByOriginalId :
      indexByOriginalLabel >= 0 ? indexByOriginalLabel :
      indexByRequestedLabel >= 0 ? indexByRequestedLabel : 0;
    q.alternativaCorretaId = expectedLabels[chosenIndex];

    const optionIds = q.alternativas.map((a) => (a.id || '').toString().trim());
    const optionLabels = q.alternativas.map((a) => (a.label || '').toString().trim().toUpperCase());

    const uniqueIds = new Set(optionIds);
    if (uniqueIds.size !== 5) {
      throw new Error(`Questao ${idx + 1} invalida: alternativas com IDs duplicados.`);
    }

    const uniqueLabels = new Set(optionLabels);
    if (uniqueLabels.size !== 5 || expectedLabels.some((label) => !uniqueLabels.has(label))) {
      throw new Error(`Questao ${idx + 1} invalida: alternativas devem usar labels unicos A, B, C, D e E.`);
    }

    q.alternativas.forEach((alt, altIdx) => {
      if (!alt.texto || alt.texto.trim().length < 2) {
        throw new Error(`Questao ${idx + 1} invalida: texto da alternativa ${altIdx + 1} vazio.`);
      }
    });

    const correct = q.alternativas.find((a) => a.id === q.alternativaCorretaId);
    if (!correct) {
      throw new Error(`Questao ${idx + 1} invalida: alternativa correta nao encontrada.`);
    }

    // Campo unico de gabarito: deve apontar para uma unica alternativa existente.
    const equalToCorrectIdCount = optionIds.filter((id) => id === q.alternativaCorretaId).length;
    if (equalToCorrectIdCount !== 1) {
      throw new Error(`Questao ${idx + 1} invalida: deve haver exatamente uma alternativa correta.`);
    }

    if (!q.explicacao || q.explicacao.trim().length < 40) {
      throw new Error(`Questao ${idx + 1} invalida: explicacao insuficiente.`);
    }

    // Exige explicacao mencionando as alternativas para reduzir risco de ambiguidade.
    const explanation = q.explicacao.toUpperCase();
    const missingLabelsInExplanation = expectedLabels.filter((label) => {
      const withParen = `${label})`;
      const plain = ` ${label} `;
      const withDash = `${label} -`;
      const withColon = `${label}:`;
      return !(
        explanation.includes(withParen) ||
        explanation.includes(withDash) ||
        explanation.includes(withColon) ||
        explanation.includes(plain)
      );
    });

    if (missingLabelsInExplanation.length > 0) {
      throw new Error(
        `Questao ${idx + 1} invalida: explicacao deve justificar alternativa correta e incorretas (faltando: ${missingLabelsInExplanation.join(', ')}).`
      );
    }
  });
}
