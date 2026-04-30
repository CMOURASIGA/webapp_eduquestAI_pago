import { Exam } from '../types/exam';
import { QUESTIONS_PER_EXAM } from './examConfig';

const EXPECTED_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
type ExpectedLabel = typeof EXPECTED_LABELS[number];

function normalizeAlternativeLetter(raw: unknown): ExpectedLabel | '' {
  const requested = String(raw || '').trim().toUpperCase();
  if (!requested) return '';

  // Mantem apenas A-E ou 1-5 (formatos comuns: "(A)", "LETRA A", "A)", "1", etc.)
  const cleaned = requested.replace(/[^A-E1-5]/g, '');
  if (!cleaned || cleaned.length !== 1) return '';

  if (cleaned >= '1' && cleaned <= '5') {
    const num = Number(cleaned);
    return EXPECTED_LABELS[num - 1] || '';
  }

  return (EXPECTED_LABELS as readonly string[]).includes(cleaned) ? (cleaned as ExpectedLabel) : '';
}

// Validacao para garantir consistencia estrutural e pedagogica minima da prova.
export function validateExam(exam: Pick<Exam, 'questions'>) {
  if (!exam.questions || exam.questions.length !== QUESTIONS_PER_EXAM) {
    throw new Error(`Prova invalida: deve conter ${QUESTIONS_PER_EXAM} questoes.`);
  }

  exam.questions.forEach((q, idx) => {
    const expectedLabels = [...EXPECTED_LABELS];

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
    const requestedCorretaRaw = q.alternativaCorretaId;
    const requestedCorreta = normalizeAlternativeLetter(requestedCorretaRaw);
    if (!requestedCorreta) {
      throw new Error(
        `Questao ${idx + 1} invalida: alternativaCorretaId "${String(requestedCorretaRaw || '').trim()}" nao mapeavel para nenhuma das alternativas (A-E).`
      );
    }

    const oldByLabel = new Map<ExpectedLabel, { id: string; label: string; texto: string }>();
    oldAlternativas.forEach((alt) => {
      const normalized = normalizeAlternativeLetter(alt.label || alt.id);
      if (normalized && !oldByLabel.has(normalized)) oldByLabel.set(normalized, alt);
    });

    q.alternativas = expectedLabels.map((label, altIdx) => {
      const src = oldByLabel.get(label as ExpectedLabel) || oldAlternativas[altIdx] || { id: '', label: '', texto: '' };
      const safeTexto = src.texto && src.texto.trim().length >= 2 ? src.texto.trim() : `Opcao ${label}`;
      return {
        id: label,
        label,
        texto: safeTexto
      };
    });
    // Sem fallback silencioso: se nao for mapeavel para A-E, a questao e invalida (forca regeneracao).
    q.alternativaCorretaId = requestedCorreta;

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
      console.warn(
        `Questao ${idx + 1}: explicacao sem todas as referencias A-E (faltando: ${missingLabelsInExplanation.join(', ')}).`
      );
    }
  });
}
