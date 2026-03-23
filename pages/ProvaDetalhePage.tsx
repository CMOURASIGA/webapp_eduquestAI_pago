
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Exam, Question, Alternative } from '../types/exam';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { QuestionCard } from '../components/provas/QuestionCard';
import { ExamSummary } from '../components/provas/ExamSummary';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { serieLabels } from '../utils/seriesUtils';
import { ArrowLeft, Send, CheckCircle2, RotateCcw, Printer, FileDown } from 'lucide-react';
import { saveAnswers } from '../services/performanceService';

export const ProvaDetalhePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appMode, userProfile } = useGeminiConfig();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (id) {
      const found = storageService.getExamById(id);
      if (found) {
        setExam(found);
        // Se a prova já foi concluída anteriormente e estamos no modo resumo, poderíamos carregar...
        // Mas para este fluxo, permitimos que o aluno responda novamente se desejar.
      }
      else navigate('/provas');
    }
  }, [id, navigate]);

  if (!exam) return null;

  const handleAnswer = (questionId: string, alternativeId: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: alternativeId }));
  };

  const handleFinish = async () => {
    if (!exam) return;

    // Calcular o score antes de salvar
    const total = exam.questions.length;
    const correctCount = exam.questions.filter(q => userAnswers[q.id] === q.alternativaCorretaId).length;
    const scorePercentage = Math.round((correctCount / total) * 100);

    // Criar o objeto atualizado
    const updatedExam: Exam = {
      ...exam,
      completed: true,
      lastScore: scorePercentage
    };

    try {
      // Persistir no localStorage
      storageService.saveExam(updatedExam);

      // Enviar respostas para o backend (dashboard de rendimento)
      const payload = {
        userId: userProfile?.name || 'usuario',
        examId: exam.id,
        disciplina: exam.disciplina,
        answers: exam.questions.map((q) => ({
          questionId: q.id,
          selectedAlternative: userAnswers[q.id],
          correctAlternative: q.alternativaCorretaId,
          isCorrect: userAnswers[q.id] === q.alternativaCorretaId,
          createdAt: new Date().toISOString()
        }))
      };
      await saveAnswers(payload);

      // Atualizar estado local para refletir a mudança
      setExam(updatedExam);
      setShowSummary(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error("Falha ao registrar respostas:", err);
      alert("As respostas foram salvas localmente, mas não foi possível registrar no servidor. Tente novamente mais tarde.");
    }
  };

  const handleReset = () => {
    setUserAnswers({});
    setShowSummary(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  const answeredCount = Object.keys(userAnswers).length;
  const isFinished = answeredCount === exam.questions.length;
  const getAnswerLabel = (question: Question) => {
    const correctId = question.alternativaCorretaId;
    const alt = question.alternativas.find((a: Alternative) => a.id === correctId);
    return alt?.label || '-';
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 print:pb-0 print:max-w-none">
      {/* Cabeçalho de Impressão (visível apenas ao imprimir) */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold uppercase">{exam.title}</h1>
            <p className="text-sm">{exam.disciplina} | {serieLabels[exam.serie]}</p>
          </div>
          <div className="text-right text-sm">
            <p>Data: ____/____/_______</p>
            <p>Nota: ___________</p>
          </div>
        </div>
        <div className="border-2 border-slate-300 p-2 mb-4">
          <p className="text-sm font-bold">ALUNO(A): __________________________________________________________________</p>
        </div>
      </div>

      <header className="mb-10 print:hidden">
        <button 
          onClick={() => navigate('/provas')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors mb-6 font-medium"
        >
          <ArrowLeft size={18} /> Voltar para lista
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="info">{exam.disciplina}</Badge>
              <Badge>{serieLabels[exam.serie]}</Badge>
              {appMode === 'aluno' && !showSummary && (
                <Badge variant="warning">Progresso: {answeredCount}/{exam.questions.length}</Badge>
              )}
              {appMode === 'aluno' && exam.completed && !showSummary && (
                <Badge variant="success">Última Nota: {exam.lastScore}%</Badge>
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-800">{exam.title}</h1>
            <p className="text-slate-500 mt-2 max-w-2xl">{exam.objetivo}</p>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer size={18} /> <span className="hidden sm:inline">Imprimir / PDF</span>
            </Button>
            
            {appMode === 'aluno' && isFinished && !showSummary && (
              <Button onClick={handleFinish} className="shadow-lg">
                <CheckCircle2 size={18} /> Finalizar
              </Button>
            )}
            
            {showSummary && (
              <Button onClick={handleReset} variant="outline">
                <RotateCcw size={18} /> Reiniciar
              </Button>
            )}
          </div>
        </div>
      </header>

      {showSummary ? (
        <ExamSummary 
          questions={exam.questions} 
          userAnswers={userAnswers} 
          onReset={handleReset}
        />
      ) : (
        <div className="space-y-6 print:space-y-8">
          {exam.questions.map((question, idx) => {
            const isPageEnd = (idx + 1) % 3 === 0;
            return (
              <div 
                key={question.id} 
                className={`print:break-inside-avoid print:bg-white print:border print:border-slate-200 print:rounded-2xl print:p-4 print:shadow-none ${isPageEnd ? 'print:break-after-page' : ''}`}
              >
                <QuestionCard
                  index={idx}
                  question={question}
                  mode={appMode}
                  onAnswer={handleAnswer}
                  selectedAnswerId={userAnswers[question.id]}
                />
              </div>
            );
          })}

          {/* Gabarito (impressao) */}
          <div className="hidden print:block break-before-page mt-12">
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <h2 className="text-2xl font-black uppercase">Gabarito</h2>
              <p className="text-sm text-slate-700">Resumos das respostas corretas para conferencia rapida.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 print:text-sm">
              {exam.questions.map((q, idx) => (
                <div key={q.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
                  <div className="font-bold text-slate-800">Questao {idx + 1}</div>
                  <div className="text-indigo-700 font-black text-lg">{getAnswerLabel(q)}</div>
                </div>
              ))}
            </div>
          </div>

          {appMode === 'aluno' && !isFinished && (
            <div className="sticky bottom-8 left-0 right-0 p-4 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl shadow-xl flex items-center justify-between z-10 animate-in slide-in-from-bottom-8 print:hidden">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                  {Math.round((answeredCount / exam.questions.length) * 100)}%
                </div>
                <div>
                  <div className="font-bold text-slate-800">Seu Progresso</div>
                  <div className="text-xs text-slate-500">{answeredCount} de {exam.questions.length} respondidas</div>
                </div>
              </div>
              <Button variant="ghost" disabled>
                Responda todas para finalizar
              </Button>
            </div>
          )}

          {appMode === 'aluno' && isFinished && (
            <div className="flex justify-center pt-8 print:hidden">
              <Button onClick={handleFinish} className="px-12 py-4 text-xl shadow-2xl">
                <Send size={24} /> Finalizar Simulado
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Rodapé de Impressão */}
      <div className="hidden print:block mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
        Gerado por EduQuest IA - Material de Estudo Personalizado
      </div>
    </div>
  );
};
