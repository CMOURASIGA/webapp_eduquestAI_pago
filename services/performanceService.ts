export interface AnswerRecord {
  questionId: string;
  selectedAlternative: string;
  correctAlternative: string;
  isCorrect: boolean;
  createdAt?: string;
}

export interface PerformanceDiscipline {
  correct: number;
  total: number;
  accuracy: number;
}

export interface PerformanceResponse {
  disciplines: Record<string, PerformanceDiscipline>;
  totals: { exams: number; questions: number; accuracy: number };
}

export async function saveAnswers(payload: {
  userId: string;
  examId: string;
  disciplina: string;
  answers: AnswerRecord[];
}) {
  const res = await fetch('/api/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao salvar respostas: ${text}`);
  }
  return res.json();
}

export async function fetchUserPerformance(userId: string): Promise<PerformanceResponse> {
  const res = await fetch(`/api/performance/user/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao obter desempenho: ${text}`);
  }
  return res.json();
}

export async function fetchSummaryPerformance(): Promise<PerformanceResponse> {
  const res = await fetch(`/api/performance/summary`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao obter desempenho agregado: ${text}`);
  }
  return res.json();
}
