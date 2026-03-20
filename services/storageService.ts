
import { Exam } from '../types/exam';
import { GeminiConfig } from '../types/settings';

const EXAMS_KEY = 'eduquest-exams';
const CONFIG_KEY = 'eduquest-gemini-config';
const RECENT_NAMES_KEY = 'eduquest-recent-names';

export const storageService = {
  saveExam: (exam: Exam): void => {
    const exams = storageService.getExams();
    const existingIndex = exams.findIndex(e => e.id === exam.id);
    if (existingIndex > -1) {
      exams[existingIndex] = exam;
    } else {
      exams.push(exam);
    }
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  },

  getExams: (): Exam[] => {
    const data = localStorage.getItem(EXAMS_KEY);
    return data ? JSON.parse(data) : [];
  },

  getExamById: (id: string): Exam | undefined => {
    return storageService.getExams().find(e => e.id === id);
  },

  deleteExam: (id: string): void => {
    const exams = storageService.getExams().filter(e => e.id !== id);
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  },

  saveGeminiConfig: (config: GeminiConfig): void => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  getGeminiConfig: (): GeminiConfig | null => {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  },

  getRecentNames: (): string[] => {
    const data = localStorage.getItem(RECENT_NAMES_KEY);
    return data ? JSON.parse(data) : [];
  },

  addRecentName: (name: string): void => {
    const names = storageService.getRecentNames();
    const normalizedNewName = name.trim();
    
    // Filtra para evitar duplicatas (ignorando case) e mantém apenas os últimos 5
    const filteredNames = [
      normalizedNewName,
      ...names.filter(n => n.toLowerCase() !== normalizedNewName.toLowerCase())
    ].slice(0, 5);

    localStorage.setItem(RECENT_NAMES_KEY, JSON.stringify(filteredNames));
  }
};
