
import { SerieEscolar } from '../types/exam';

export const subjectsByGrade: Record<string, string[]> = {
  fundamental_1: [
    "Português", "Matemática", "Ciências", "História", "Geografia", "Artes", "Educação Física", "Inglês"
  ],
  fundamental_2: [
    "Língua Portuguesa", "Matemática", "Ciências Naturais", "História", "Geografia", "Inglês", "Artes", "Educação Física", "Ensino Religioso"
  ],
  medio: [
    "Língua Portuguesa", "Literatura", "Redação", "Matemática", "Biologia", "Física", "Química", "História", "Geografia", "Sociologia", "Filosofia", "Língua Inglesa", "Artes"
  ]
};

export const getSubjectsForSerie = (serie: SerieEscolar): string[] => {
  if (serie.includes("fundamental")) {
    const year = parseInt(serie.split("_")[0]);
    return year <= 5 ? subjectsByGrade.fundamental_1 : subjectsByGrade.fundamental_2;
  }
  return subjectsByGrade.medio;
};
