
import { SerieEscolar } from '../types/exam';

export const serieLabels: Record<SerieEscolar, string> = {
  "1_ano_fundamental": "1º ano do Ensino Fundamental",
  "2_ano_fundamental": "2º ano do Ensino Fundamental",
  "3_ano_fundamental": "3º ano do Ensino Fundamental",
  "4_ano_fundamental": "4º ano do Ensino Fundamental",
  "5_ano_fundamental": "5º ano do Ensino Fundamental",
  "6_ano_fundamental": "6º ano do Ensino Fundamental",
  "7_ano_fundamental": "7º ano do Ensino Fundamental",
  "8_ano_fundamental": "8º ano do Ensino Fundamental",
  "9_ano_fundamental": "9º ano do Ensino Fundamental",
  "1_serie_medio": "1ª série do Ensino Médio",
  "2_serie_medio": "2ª série do Ensino Médio",
  "3_serie_medio": "3ª série do Ensino Médio",
};

export const getAgeRange = (serie: SerieEscolar): string => {
  const map: Record<SerieEscolar, string> = {
    "1_ano_fundamental": "6-7 anos",
    "2_ano_fundamental": "7-8 anos",
    "3_ano_fundamental": "8-9 anos",
    "4_ano_fundamental": "9-10 anos",
    "5_ano_fundamental": "10-11 anos",
    "6_ano_fundamental": "11-12 anos",
    "7_ano_fundamental": "12-13 anos",
    "8_ano_fundamental": "13-14 anos",
    "9_ano_fundamental": "14-15 anos",
    "1_serie_medio": "15-16 anos",
    "2_serie_medio": "16-17 anos",
    "3_serie_medio": "17-18 anos",
  };
  return map[serie];
};

export const getSchoolLevel = (serie: SerieEscolar): string => {
  if (serie.includes("fundamental")) {
    const num = parseInt(serie.split("_")[0]);
    return num <= 5 ? "Fundamental I" : "Fundamental II";
  }
  return "Ensino Médio";
};
