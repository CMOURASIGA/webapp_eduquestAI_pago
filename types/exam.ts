
export type SerieEscolar =
  | "1_ano_fundamental"
  | "2_ano_fundamental"
  | "3_ano_fundamental"
  | "4_ano_fundamental"
  | "5_ano_fundamental"
  | "6_ano_fundamental"
  | "7_ano_fundamental"
  | "8_ano_fundamental"
  | "9_ano_fundamental"
  | "1_serie_medio"
  | "2_serie_medio"
  | "3_serie_medio";

export interface Alternative {
  id: string;
  label: "A" | "B" | "C" | "D" | "E";
  texto: string;
}

export interface Question {
  id: string;
  enunciado: string;
  alternativas: Alternative[];
  alternativaCorretaId: string;
  explicacao: string;
  nivelDificuldade?: "baixa" | "media" | "alta";
  competenciaOuHabilidade?: string;
}

export interface Exam {
  id: string;
  title: string;
  disciplina: string;
  serie: SerieEscolar;
  objetivo: string;
  conteudoBase: string[];
  createdAt: string;
  questions: Question[];
  // Novos campos para tracking de progresso do aluno localmente
  lastScore?: number;
  completed?: boolean;
}

export type AppMode = "professor" | "aluno";

export interface UserProfile {
  name: string;
  role: AppMode;
}
