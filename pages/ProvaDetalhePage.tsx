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
import { ArrowLeft, Send, CheckCircle2, RotateCcw, Printer } from 'lucide-react';
import { saveAnswers } from '../services/performanceService';

export const ProvaDetalhePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appMode, userProfile } = useGeminiConfig();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [reviewMode, setReviewMode] = useState<'none' | 'errors'>('none');

  useEffect(() => {
    if (id) {
      const found = storageService.getExamById(id);
      if (found) {
        setExam(found);
        // Se a prova ja foi concluida anteriormente e estamos no modo resumo, poderiamos carregar...
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

      // Atualizar estado local para refletir a mudanca
      setExam(updatedExam);
      setShowSummary(true);
      setReviewMode('none');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error("Falha ao registrar respostas:", err);
      alert("As respostas foram salvas localmente, mas nao foi possivel registrar no servidor. Tente novamente mais tarde.");
    }
  };

  const handleReset = () => {
    setUserAnswers({});
    setShowSummary(false);
    setReviewMode('none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  const answeredCount = Object.keys(userAnswers).length;
  const isFinished = answeredCount === exam.questions.length;
  const wrongQuestions = exam.questions.filter((q) => {
    const selected = userAnswers[q.id];
    return selected && selected !== q.alternativaCorretaId;
  });
  const questionsForReview = wrongQuestions.length > 0 ? wrongQuestions : exam.questions;

  const getAnswerLabel = (question: Question) => {
    const correctId = question.alternativaCorretaId;
    const alt = question.alternativas.find((a: Alternative) => a.id === correctId);
    return alt?.label || '-';
  };

  const getAlternativeById = (question: Question, alternativeId?: string) => {
    if (!alternativeId) return null;
    return question.alternativas.find((a: Alternative) => a.id === alternativeId) || null;
  };

  const hasPrintableResults = answeredCount > 0;
  const printableCorrectCount = exam.questions.filter((q) => userAnswers[q.id] === q.alternativaCorretaId).length;
  const printableWrongCount = answeredCount - printableCorrectCount;
  const printableScore = answeredCount > 0
    ? Math.round((printableCorrectCount / exam.questions.length) * 100)
    : 0;

  const toggleReviewErrors = () => {
    setReviewMode((prev) => prev === 'errors' ? 'none' : 'errors');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const questionPairs: Array<[Question, Question | null]> = [];
  for (let i = 0; i < exam.questions.length; i += 2) {
    questionPairs.push([exam.questions[i], exam.questions[i + 1] || null]);
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 print:pb-0 print:max-w-none">
      <div className="print:hidden">
        <header className="mb-10">
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
                  <Badge variant="success">Ultima Nota: {exam.lastScore}%</Badge>
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
          <>
            <ExamSummary
              questions={exam.questions}
              userAnswers={userAnswers}
              onReset={handleReset}
              onReviewErrors={toggleReviewErrors}
              isReviewingErrors={reviewMode === 'errors'}
              wrongCount={wrongQuestions.length}
            />

            {reviewMode === 'errors' && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800">
                    {wrongQuestions.length > 0 ? 'Questoes que voce errou' : 'Revisao rapida das questoes'}
                  </h3>
                  <Badge variant="warning">
                    {wrongQuestions.length > 0
                      ? `${wrongQuestions.length} de ${exam.questions.length}`
                      : `${exam.questions.length} questoes respondidas`}
                  </Badge>
                </div>
                <p className="text-slate-500">
                  {wrongQuestions.length > 0
                    ? 'Confira as alternativas que marcou em vermelho e as corretas em verde.'
                    : 'Nenhum erro desta vez! Veja abaixo o gabarito comentado.'}
                </p>
                <div className="space-y-6">
                  {questionsForReview.map((question) => {
                    const questionIndex = exam.questions.findIndex((q) => q.id === question.id);
                    return (
                      <QuestionCard
                        key={question.id}
                        index={questionIndex}
                        question={question}
                        mode={appMode}
                        selectedAnswerId={userAnswers[question.id]}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {exam.questions.map((question, idx) => (
              <div key={question.id}>
                <QuestionCard
                  index={idx}
                  question={question}
                  mode={appMode}
                  onAnswer={handleAnswer}
                  selectedAnswerId={userAnswers[question.id]}
                />
              </div>
            ))}

            {appMode === 'aluno' && !isFinished && (
              <div className="sticky bottom-8 left-0 right-0 p-4 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl shadow-xl flex items-center justify-between z-10 animate-in slide-in-from-bottom-8">
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
              <div className="flex justify-center pt-8">
                <Button onClick={handleFinish} className="px-12 py-4 text-xl shadow-2xl">
                  <Send size={24} /> Finalizar Simulado
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden print:block text-slate-900">
        <div className="mb-6 border-b-2 border-slate-900 pb-4">
          <div className="flex justify-between items-start gap-6 mb-4">
            <div>
              <h1 className="text-2xl font-black uppercase">{exam.title}</h1>
              <p className="text-sm mt-1">{exam.disciplina} | {serieLabels[exam.serie]}</p>
            </div>
            <div className="text-right text-sm leading-6 shrink-0">
              <p>Data: ____/____/________</p>
              <p>Nota: ___________</p>
            </div>
          </div>
          <div className="border border-slate-400 p-2 text-sm font-semibold">
            ALUNO(A): __________________________________________________________________
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {questionPairs.map(([leftQuestion, rightQuestion], pairIndex) => {
            const leftIdx = pairIndex * 2;
            return (
              <React.Fragment key={`print-question-pair-${leftQuestion.id}`}>
                <div className="border border-slate-300 rounded-lg p-3 break-inside-avoid">
                  <h3 className="font-bold text-[13px] leading-5 mb-2">Questao {leftIdx + 1}</h3>
                  <p className="text-[11px] leading-5 mb-2">{leftQuestion.enunciado}</p>
                  <div className="space-y-1 text-[10px] leading-4">
                    {leftQuestion.alternativas.map((alt) => (
                      <p key={`${leftQuestion.id}-${alt.id}`} className="border border-slate-200 rounded px-2 py-1 bg-slate-50">
                        <span className="font-semibold">{alt.label})</span> {alt.texto}
                      </p>
                    ))}
                  </div>
                </div>

                {rightQuestion ? (
                  <div className="border border-slate-300 rounded-lg p-3 break-inside-avoid">
                    <h3 className="font-bold text-[13px] leading-5 mb-2">Questao {leftIdx + 2}</h3>
                    <p className="text-[11px] leading-5 mb-2">{rightQuestion.enunciado}</p>
                    <div className="space-y-1 text-[10px] leading-4">
                      {rightQuestion.alternativas.map((alt) => (
                        <p key={`${rightQuestion.id}-${alt.id}`} className="border border-slate-200 rounded px-2 py-1 bg-slate-50">
                          <span className="font-semibold">{alt.label})</span> {alt.texto}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="break-before-page">
          <div className="border-b-2 border-slate-900 pb-3 mb-5">
            <h2 className="text-xl font-black uppercase">Gabarito e Justificativas</h2>
            <p className="text-xs mt-1">Relatorio consolidado das questoes e respostas corretas.</p>
          </div>

          {hasPrintableResults && (
            <div className="mb-5 border border-slate-300 rounded-lg p-3 text-sm">
              <p><strong>Resultado:</strong> {printableCorrectCount} acertos, {printableWrongCount} erros, {exam.questions.length - answeredCount} nao respondidas.</p>
              <p><strong>Aproveitamento:</strong> {printableScore}%</p>
            </div>
          )}

          <div className="space-y-3">
            {questionPairs.map(([leftQuestion, rightQuestion], pairIndex) => {
              const leftIdx = pairIndex * 2;
              const leftCorrectAlternative = getAlternativeById(leftQuestion, leftQuestion.alternativaCorretaId);
              const leftSelectedAlternative = getAlternativeById(leftQuestion, userAnswers[leftQuestion.id]);
              const leftIsCorrect = userAnswers[leftQuestion.id] === leftQuestion.alternativaCorretaId;

              const rightCorrectAlternative = rightQuestion
                ? getAlternativeById(rightQuestion, rightQuestion.alternativaCorretaId)
                : null;
              const rightSelectedAlternative = rightQuestion
                ? getAlternativeById(rightQuestion, userAnswers[rightQuestion.id])
                : null;
              const rightIsCorrect = rightQuestion
                ? userAnswers[rightQuestion.id] === rightQuestion.alternativaCorretaId
                : false;

              return (
                <div key={`print-answer-row-${leftQuestion.id}`} className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="border border-slate-300 rounded-lg p-3 break-inside-avoid">
                    <p className="font-bold mb-2">Questao {leftIdx + 1}</p>
                    <p className="mb-1">
                      <strong>Gabarito:</strong> {leftCorrectAlternative?.label || getAnswerLabel(leftQuestion)}
                      {leftCorrectAlternative ? ` - ${leftCorrectAlternative.texto}` : ''}
                    </p>

                    {hasPrintableResults && (
                      <p className="mb-1">
                        <strong>Marcada:</strong> {leftSelectedAlternative ? `${leftSelectedAlternative.label} - ${leftSelectedAlternative.texto}` : 'Nao respondida'}
                        {' | '}
                        <strong>Status:</strong> {leftSelectedAlternative ? (leftIsCorrect ? 'Acertou' : 'Errou') : 'Nao respondida'}
                      </p>
                    )}

                    <p><strong>Justificativa:</strong> {leftQuestion.explicacao}</p>
                  </div>

                  {rightQuestion ? (
                    <div className="border border-slate-300 rounded-lg p-3 break-inside-avoid">
                      <p className="font-bold mb-2">Questao {leftIdx + 2}</p>
                      <p className="mb-1">
                        <strong>Gabarito:</strong> {rightCorrectAlternative?.label || getAnswerLabel(rightQuestion)}
                        {rightCorrectAlternative ? ` - ${rightCorrectAlternative.texto}` : ''}
                      </p>

                      {hasPrintableResults && (
                        <p className="mb-1">
                          <strong>Marcada:</strong> {rightSelectedAlternative ? `${rightSelectedAlternative.label} - ${rightSelectedAlternative.texto}` : 'Nao respondida'}
                          {' | '}
                          <strong>Status:</strong> {rightSelectedAlternative ? (rightIsCorrect ? 'Acertou' : 'Errou') : 'Nao respondida'}
                        </p>
                      )}

                      <p><strong>Justificativa:</strong> {rightQuestion.explicacao}</p>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500">
          Gerado por EduQuest IA - Material de Estudo Personalizado
        </div>
      </div>
    </div>
  );
};
