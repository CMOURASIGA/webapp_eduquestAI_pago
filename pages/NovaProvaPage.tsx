
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SerieEscolar } from '../types/exam';
import { serieLabels } from '../utils/seriesUtils';
import { getSubjectsForSerie } from '../utils/subjectUtils';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { generateExamWithGemini } from '../services/geminiService';
import { generateExamWithOpenAI } from '../services/openaiService';
import { storageService } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { LoadingOverlay } from '../components/feedback/LoadingOverlay';
import { BrainCircuit, BookOpen, Target, FileText, AlertTriangle } from 'lucide-react';

export const NovaProvaPage: React.FC = () => {
  const { selectedModel, aiProvider } = useGeminiConfig();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    serie: '6_ano_fundamental' as SerieEscolar,
    disciplina: '',
    objetivo: '',
    conteudoBase: '',
    nivelDificuldade: 'media' as 'baixa' | 'media' | 'alta'
  });

  const availableSubjects = getSubjectsForSerie(formData.serie);

  // Garantir que a disciplina mude caso não exista na nova série
  useEffect(() => {
    if (!availableSubjects.includes(formData.disciplina)) {
      setFormData(prev => ({ ...prev, disciplina: availableSubjects[0] }));
    }
  }, [formData.serie]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const params = {
        ...formData,
        conteudoBase: [formData.conteudoBase],
        modelName: selectedModel
      };

      let generated;
      if (aiProvider === 'openai') {
        generated = await generateExamWithOpenAI(params);
      } else {
        generated = await generateExamWithGemini(params);
      }

      const newExam = {
        ...generated,
        id: crypto.randomUUID(),
        title: formData.title,
        disciplina: formData.disciplina,
        serie: formData.serie,
        objetivo: formData.objetivo,
        conteudoBase: [formData.conteudoBase],
      };

      storageService.saveExam(newExam as any);
      navigate(`/provas/${newExam.id}`);
    } catch (err: any) {
      console.error(err);
      setError(`Ocorreu um erro ao gerar a prova com ${aiProvider === 'openai' ? 'OpenAI' : 'Gemini'}. Verifique sua conexão ou tente um conteúdo base diferente. Detalhes: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pb-12">
      {isLoading && <LoadingOverlay message={`A IA (${aiProvider === 'openai' ? 'OpenAI' : 'Gemini'}) está elaborando 40 questões pedagógicas... Por favor, aguarde.`} />}

      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Criar Material de Estudo</h1>
          <p className="text-slate-500">Transforme conteúdo bruto em um simulado inteligente de 40 questões.</p>
        </div>
        <div className="hidden md:flex p-3 rounded-2xl bg-indigo-100 text-indigo-600">
          <BrainCircuit size={32} />
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertTriangle />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="text-emerald-500" size={20} />
              <h2 className="text-xl font-bold text-slate-800">Conteúdo Base</h2>
            </div>
            <textarea
              required
              value={formData.conteudoBase}
              onChange={(e) => setFormData({ ...formData, conteudoBase: e.target.value })}
              className="flex-1 w-full min-h-[400px] p-6 rounded-2xl border-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 font-serif leading-relaxed"
              placeholder="Cole aqui o texto, tópicos ou capítulos que deseja usar como referência para a geração das questões..."
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Target className="text-indigo-600" size={20} />
              <h2 className="text-xl font-bold text-slate-800">Parâmetros</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Título da Prova</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: Simulado de Biomas Brasileiros"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Série / Ano</label>
                <select
                  value={formData.serie}
                  onChange={(e) => setFormData({ ...formData, serie: e.target.value as SerieEscolar })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {Object.entries(serieLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Disciplina</label>
                <select
                  value={formData.disciplina}
                  onChange={(e) => setFormData({ ...formData, disciplina: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {availableSubjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Objetivo Pedagógico</label>
                <textarea
                  required
                  rows={2}
                  value={formData.objetivo}
                  onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="O que o aluno deve aprender com esta prova?"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Nível de Dificuldade</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['baixa', 'media', 'alta'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFormData({ ...formData, nivelDificuldade: lvl as any })}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.nivelDificuldade === lvl ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full py-5 text-xl shadow-xl" isLoading={isLoading}>
              Gerar Prova com IA
            </Button>
            <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest font-bold">
              40 QUESTÕES • ESTILO ENEM • BNCC
            </p>
          </section>
        </div>
      </form>
    </div>
  );
};
