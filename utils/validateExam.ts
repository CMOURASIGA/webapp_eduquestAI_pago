import { Exam } from '../types/exam';

// Validação básica para garantir que a prova tem a estrutura mínima esperada.
export function validateExam(exam: Pick<Exam, 'questions'>) {
  if (!exam.questions || exam.questions.length !== 5) {
    throw new Error("Prova inválida: deve conter 5 questões.");
  }

  exam.questions.forEach((q, idx) => {
    if (!q.alternativas || q.alternativas.length !== 5) {
      throw new Error(`Questão ${idx + 1} inválida: deve conter 5 alternativas.`);
    }

    const correct = q.alternativas.find(a => a.id === q.alternativaCorretaId);
    if (!correct) {
      throw new Error(`Questão ${idx + 1} inválida: alternativa correta não encontrada.`);
    }

    if (!q.explicacao || q.explicacao.trim().length < 20) {
      throw new Error(`Questão ${idx + 1} inválida: explicação insuficiente.`);
    }

    // Sinaliza explicações frágeis ou não alinhadas com a alternativa correta
    if (q.explicacao.trim().length < 80) {
      console.warn(`Questão ${idx + 1}: explicação curta (<80 caracteres).`);
    }
    if (!q.explicacao.includes(q.alternativaCorretaId)) {
      console.warn(`Questão ${idx + 1}: explicação pode não mencionar a alternativa correta (${q.alternativaCorretaId}).`);
    }
  });
}
