
import React from 'react';
import { Question } from '../../types/exam';
import { Button } from '../ui/Button';
import { Trophy, Target, AlertCircle, BookOpen } from 'lucide-react';

interface ExamSummaryProps {
  questions: Question[];
  userAnswers: Record<string, string>;
  onReset: () => void;
}

export const ExamSummary: React.FC<ExamSummaryProps> = ({ questions, userAnswers, onReset }) => {
  const total = questions.length;
  const correctCount = questions.filter(q => userAnswers[q.id] === q.alternativaCorretaId).length;
  const scorePercentage = Math.round((correctCount / total) * 100);

  const getMessage = () => {
    if (scorePercentage >= 90) return "Desempenho Excelente! Você dominou o conteúdo.";
    if (scorePercentage >= 70) return "Muito bem! Continue estudando os detalhes.";
    if (scorePercentage >= 50) return "Bom progresso, mas revise os pontos que errou.";
    return "Não desanime! Use as explicações para reforçar sua base.";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center">
        <div className="inline-flex p-4 rounded-full bg-amber-50 text-amber-500 mb-6">
          <Trophy size={64} />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Simulado Concluído!</h2>
        <p className="text-slate-500 mb-8">{getMessage()}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-50 p-6 rounded-2xl">
            <Target className="mx-auto text-indigo-600 mb-2" size={32} />
            <div className="text-2xl font-black text-slate-800">{correctCount}/{total}</div>
            <div className="text-sm text-slate-500">Acertos</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl">
            <div className="text-4xl font-black text-indigo-600 mb-2">{scorePercentage}%</div>
            <div className="text-sm text-slate-500">Aproveitamento</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl">
            <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
            <div className="text-2xl font-black text-slate-800">{total - correctCount}</div>
            <div className="text-sm text-slate-500">Erros</div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Revisar Questões
          </Button>
          <Button variant="primary" onClick={onReset}>
            Refazer Simulado
          </Button>
        </div>
      </div>

      <div className="bg-indigo-600 p-8 rounded-2xl shadow-lg text-white">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={32} />
          <h3 className="text-xl font-bold">Recomendações de Estudo</h3>
        </div>
        <p className="opacity-90 leading-relaxed mb-6">
          Com base no seu desempenho, sugerimos focar nos tópicos das questões que você errou. 
          Aproveite as explicações fornecidas pela IA para entender o raciocínio correto.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {questions.filter(q => userAnswers[q.id] !== q.alternativaCorretaId).slice(0, 4).map((q, idx) => (
            <div key={idx} className="bg-white/10 p-4 rounded-xl border border-white/20">
              <span className="text-xs font-bold uppercase opacity-60">Tema Sugerido</span>
              <p className="font-medium text-sm line-clamp-2">{q.competenciaOuHabilidade || "Tópico da Questão " + (questions.indexOf(q) + 1)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
