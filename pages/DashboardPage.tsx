
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Exam } from '../types/exam';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { EmptyState } from '../components/feedback/EmptyState';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchUserPerformance, fetchSummaryPerformance, PerformanceResponse } from '../services/performanceService';
import { 
  FilePlus, 
  BookOpen, 
  Clock, 
  ChevronRight, 
  Trophy, 
  Target, 
  TrendingUp,
  BrainCircuit,
  Sparkles
} from 'lucide-react';
import { serieLabels } from '../utils/seriesUtils';

const classifyAccuracy = (acc: number) => {
  if (acc <= 40) return { label: 'Precisa reforçar', color: 'text-red-600' };
  if (acc <= 70) return { label: 'Em desenvolvimento', color: 'text-amber-600' };
  return { label: 'Bom domínio', color: 'text-emerald-600' };
};

export const DashboardPage: React.FC = () => {
  const { appMode, userName, userProfile, accountStatus } = useGeminiConfig();
  const [exams, setExams] = useState<Exam[]>([]);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [summaryPerf, setSummaryPerf] = useState<PerformanceResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setExams(storageService.getExams().sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
    // carrega desempenho
    const load = async () => {
      try {
        if (appMode === 'aluno' && userProfile?.name) {
          const perf = await fetchUserPerformance(userProfile.name);
          setPerformance(perf);
        }
        if (appMode === 'professor') {
          const perf = await fetchSummaryPerformance();
          setSummaryPerf(perf);
        }
      } catch (e) {
        console.error("Falha ao carregar desempenho:", e);
      }
    };
    load();
  }, []);

  const completedExams = useMemo(() => exams.filter(e => e.completed), [exams]);

  const stats = useMemo(() => {
    if (completedExams.length === 0) return null;

    const disciplineStats: Record<string, { total: number, sum: number }> = {};
    
    completedExams.forEach(exam => {
      if (!disciplineStats[exam.disciplina]) {
        disciplineStats[exam.disciplina] = { total: 0, sum: 0 };
      }
      disciplineStats[exam.disciplina].total += 1;
      disciplineStats[exam.disciplina].sum += (exam.lastScore || 0);
    });

    const averages = Object.entries(disciplineStats).map(([name, data]) => ({
      name,
      avg: Math.round(data.sum / data.total)
    }));

    const sorted = [...averages].sort((a, b) => b.avg - a.avg);
    
    return {
      averageScore: Math.round(completedExams.reduce((acc, curr) => acc + (curr.lastScore || 0), 0) / completedExams.length),
      topSubject: sorted[0],
      lowestSubject: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      totalDisciplines: averages.length
    };
  }, [completedExams]);

  if (exams.length === 0) {
    return (
      <div className="py-12">
        <EmptyState 
          title={`Olá, ${userName}!`}
          description={appMode === 'professor' 
            ? "Sua biblioteca de provas está vazia. Crie materiais incríveis para seus alunos agora mesmo."
            : "Você ainda não tem simulados disponíveis. Peça ao seu professor ou gere um para começar a estudar!"}
          icon={appMode === 'professor' ? FilePlus : BrainCircuit}
          actionLabel={appMode === 'professor' ? "Gerar minha primeira prova" : "Explorar Provas"}
          onAction={() => navigate(appMode === 'professor' ? '/nova-prova' : '/provas')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Boas-vindas, <span className="text-indigo-600">{userName}</span>!</h1>
        <p className="text-slate-500">
          {appMode === 'professor' ? 'Gerencie seus materiais e acompanhe sua produtividade.' : 'Acompanhe seu desempenho e continue evoluindo nos estudos.'}
        </p>
      </header>

      {/* Grid de Stats Dinâmico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {appMode === 'professor' ? (
          <>
            <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl flex flex-col justify-between">
              <BookOpen className="opacity-50" size={32} />
              <div>
                <div className="text-4xl font-black">{exams.length}</div>
                <div className="text-indigo-100 text-sm font-medium">Provas Produzidas</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <Clock className="mb-4 text-indigo-600 opacity-80" size={32} />
              <div className="text-2xl font-black text-slate-800">
                {exams[0] ? new Date(exams[0].createdAt).toLocaleDateString('pt-BR') : 'N/A'}
              </div>
              <div className="text-slate-500 text-sm font-medium">Última Geração</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="text-lg font-bold text-slate-800 leading-tight">Média de Questões</div>
              <div className="text-3xl font-black text-indigo-600">{accountStatus?.maxQuestionsPerExam || 40}</div>
              <p className="text-xs text-slate-400 italic">Limite atual de questões por prova</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl flex flex-col justify-between">
              <Trophy className="opacity-50" size={32} />
              <div>
                <div className="text-4xl font-black">{completedExams.length}</div>
                <div className="text-emerald-100 text-sm font-medium">Simulados Concluídos</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <TrendingUp className="mb-4 text-emerald-600 opacity-80" size={32} />
              <div className="text-3xl font-black text-slate-800">{stats?.averageScore || 0}%</div>
              <div className="text-slate-500 text-sm font-medium">Média de Acertos</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <Target className="mb-4 text-indigo-600 opacity-80" size={32} />
              <div className="text-2xl font-black text-slate-800">{exams.length}</div>
              <div className="text-slate-500 text-sm font-medium">Total de Provas Disponíveis</div>
            </div>
          </>
        )}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Materiais Recentes</h2>
            <Button variant="ghost" onClick={() => navigate('/provas')}>Ver todas</Button>
          </div>
          <div className="space-y-4">
            {exams.slice(0, 4).map((exam) => (
              <div 
                key={exam.id}
                onClick={() => navigate(`/provas/${exam.id}`)}
                className="bg-white p-4 rounded-2xl border border-slate-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${exam.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {exam.questions.length}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-indigo-600">{exam.title}</h3>
                    <div className="flex gap-2 items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>{exam.disciplina}</span>
                      <span>•</span>
                      <span>{serieLabels[exam.serie]}</span>
                    </div>
                  </div>
                </div>
                {appMode === 'aluno' && exam.completed && (
                  <Badge variant="success">{exam.lastScore}%</Badge>
                )}
                <ChevronRight className="text-slate-200 group-hover:text-indigo-400" size={20} />
              </div>
            ))}
          </div>
        </div>

        {appMode === 'aluno' && (
          <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 h-full flex flex-col justify-center">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BrainCircuit className="text-indigo-600" /> Insight da Plataforma
            </h2>
            
            {completedExams.length > 0 && stats ? (
              <>
                <p className="text-indigo-900/70 text-sm leading-relaxed mb-6">
                  Analisando seu histórico de {completedExams.length} prova(s): seu melhor aproveitamento atual está em <strong>{stats.topSubject.name}</strong>. 
                  {stats.lowestSubject ? ` Recomendamos dedicar um tempo extra para revisar os conceitos de ${stats.lowestSubject.name}, onde seu rendimento médio está em ${stats.lowestSubject.avg}%.` : " Continue assim para manter seu nível de excelência!"}
                </p>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase">Top Matéria</span>
                    <span className="text-sm font-black text-indigo-600">{stats.topSubject.name} ({stats.topSubject.avg}%)</span>
                  </div>
                  {stats.lowestSubject && (
                    <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase">A Evoluir</span>
                      <span className={`text-sm font-black ${stats.lowestSubject.avg < 60 ? 'text-red-500' : 'text-amber-500'}`}>
                        {stats.lowestSubject.name} ({stats.lowestSubject.avg}%)
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="bg-white/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="text-indigo-300" />
                </div>
                <p className="text-indigo-900/50 text-sm italic">
                  Complete seu primeiro simulado para que eu possa analisar seu desempenho e gerar recomendações personalizadas.
                </p>
              </div>
            )}
          </div>
        )}

        {appMode === 'professor' && (
          <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between h-full">
            <div>
              <h2 className="text-xl font-bold mb-2">Dica Pedagógica</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Ao criar provas de estudo, a OpenAI utiliza o <strong className="text-white">Conteúdo Base</strong> para focar nas competências do ENEM. Tente fornecer textos que tragam problemas reais do cotidiano para engajar melhor os alunos.
              </p>
            </div>
            <Button onClick={() => navigate('/nova-prova')} className="mt-8 bg-indigo-600 hover:bg-indigo-500">
              Gerar Nova Prova Agora
            </Button>
          </div>
        )}
      </section>

      {appMode === 'aluno' && performance && (
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Seu rendimento por disciplina</h2>
            <Badge>{performance.totals.questions} questões</Badge>
          </div>
          <div className="space-y-3">
            {Object.entries(performance.disciplines).map(([disc, val]) => {
              const classification = classifyAccuracy(val.accuracy);
              return (
                <div key={disc} className="p-4 border border-slate-200 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800 capitalize">{disc}</span>
                    <span className="text-sm font-black text-indigo-600">{val.accuracy}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${val.accuracy}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{val.correct}/{val.total} acertos</span>
                    <span className={classification.color}>{classification.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-sm text-slate-600">
            Provas realizadas: {performance.totals.exams} • Questões respondidas: {performance.totals.questions} • Taxa geral de acerto: {performance.totals.accuracy}%
          </div>
        </section>
      )}

      {appMode === 'professor' && summaryPerf && (
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Desempenho da turma por disciplina</h2>
            <Badge variant="info">{summaryPerf.totals.questions} respostas</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(summaryPerf.disciplines).map(([disc, val]) => {
              const classification = classifyAccuracy(val.accuracy);
              return (
                <div key={disc} className="p-4 border border-slate-200 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800 capitalize">{disc}</span>
                    <span className="text-sm font-black text-indigo-600">{val.accuracy}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${val.accuracy}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{val.correct}/{val.total} acertos</span>
                    <span className={classification.color}>{classification.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-sm text-slate-600">
            Questões respondidas: {summaryPerf.totals.questions} • Taxa média de acerto: {summaryPerf.totals.accuracy}%
          </div>
        </section>
      )}
    </div>
  );
};
