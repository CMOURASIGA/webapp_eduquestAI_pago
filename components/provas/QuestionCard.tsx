import React, { useState } from 'react';
import { Question, AppMode } from '../../types/exam';
import { Badge } from '../ui/Badge';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  index: number;
  mode: AppMode;
  onAnswer?: (questionId: string, alternativeId: string) => void;
  selectedAnswerId?: string;
  isCorrect?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  index, 
  mode, 
  onAnswer, 
  selectedAnswerId,
  isCorrect 
}) => {
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelect = (altId: string) => {
    if (mode === 'aluno' && !selectedAnswerId && onAnswer) {
      onAnswer(question.id, altId);
      setShowExplanation(true);
    }
  };

  const isAnswered = !!selectedAnswerId;
  const shouldShowExplanation = isAnswered || showExplanation;

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border transition-all print:shadow-none print:border-slate-200 print:p-4 ${isAnswered ? 'border-slate-200' : 'border-transparent'}`}>
      <div className="flex justify-between items-start mb-4 print:mb-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm print:bg-slate-200 print:text-slate-900">
            {index + 1}
          </span>
          {question.competenciaOuHabilidade && (
            <div className="print:hidden">
              <Badge variant="info">{question.competenciaOuHabilidade}</Badge>
            </div>
          )}
        </div>
        <div className="print:hidden" />
      </div>

      <p className="text-slate-800 font-medium text-lg leading-relaxed mb-6 print:text-base print:mb-4">
        {question.enunciado}
      </p>

      <div className="space-y-3 mb-6 print:space-y-2 print:mb-4">
        {question.alternativas.map((alt) => {
          const isSelected = selectedAnswerId === alt.id;
          const isRightAnswer = alt.id === question.alternativaCorretaId;
          
          let stateStyles = "border-slate-200 hover:border-indigo-300 bg-slate-50";
          
          if (isAnswered) {
            if (isRightAnswer) stateStyles = "border-emerald-500 bg-emerald-50 text-emerald-800 print:bg-slate-100";
            else if (isSelected) stateStyles = "border-red-500 bg-red-50 text-red-800";
            else stateStyles = "border-slate-100 opacity-50 bg-slate-50 print:opacity-100";
          }

          return (
            <button
              key={alt.id}
              disabled={isAnswered && mode === 'aluno'}
              onClick={() => handleSelect(alt.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 print:p-2 print:text-sm ${stateStyles}`}
            >
              <span className={`font-bold mt-0.5 ${isRightAnswer && isAnswered ? 'text-emerald-600 print:text-slate-900' : isSelected && !isRightAnswer ? 'text-red-600' : 'text-slate-400'}`}>
                {alt.label})
              </span>
              <span className="flex-1">{alt.texto}</span>
              <div className="print:hidden flex">
                {isAnswered && isRightAnswer && <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />}
                {isAnswered && isSelected && !isRightAnswer && <XCircle className="text-red-600 shrink-0" size={20} />}
              </div>
            </button>
          );
        })}
      </div>

      {shouldShowExplanation && (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-4 print:bg-white print:border-slate-200 print:p-3">
          <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold print:text-slate-900 print:text-xs">
            <Info size={18} className="print:hidden" />
            <h4>Explicação:</h4>
          </div>
          <p className="text-indigo-900 text-sm leading-relaxed print:text-slate-600 print:text-xs">
            {question.explicacao}
          </p>
        </div>
      )}
    </div>
  );
};
