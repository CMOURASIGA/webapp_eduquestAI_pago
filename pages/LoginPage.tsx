
import React, { useState, useEffect } from 'react';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { storageService } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { 
  GraduationCap, 
  UserCircle, 
  School, 
  BookOpen, 
  History, 
  HelpCircle, 
  X, 
  CheckCircle2, 
  BrainCircuit,
  Printer,
  LayoutDashboard
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useGeminiConfig();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'professor' | 'aluno'>('aluno');
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setRecentNames(storageService.getRecentNames());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      storageService.addRecentName(trimmedName);
      login({ name: trimmedName, role });
    }
  };

  const handleSelectRecent = (recentName: string) => {
    setName(recentName);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="bg-indigo-600 p-8 text-center text-white relative">
          <button 
            onClick={() => setShowInstructions(true)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
            title="Como funciona?"
          >
            <HelpCircle size={20} />
          </button>
          
          <div className="inline-flex p-3 bg-white/20 rounded-2xl mb-4">
            <GraduationCap size={48} />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter">EduQuest IA</h1>
          <p className="opacity-80 text-sm mt-2">Sua plataforma de estudos inteligente</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Como podemos te chamar?</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Digite seu nome..."
            />
            
            {recentNames.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1">
                  <History size={12} /> Usados recentemente:
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentNames.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleSelectRecent(n)}
                      className="px-3 py-1 text-xs bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-600 rounded-full transition-colors border border-transparent hover:border-indigo-200"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-slate-700">Você é...</label>
              <button 
                type="button"
                onClick={() => setShowInstructions(true)}
                className="text-[10px] font-bold text-indigo-600 uppercase hover:underline flex items-center gap-1"
              >
                <HelpCircle size={12} /> Guia de Uso
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('aluno')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${role === 'aluno' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <BookOpen size={24} />
                <span className="font-bold text-sm">Aluno</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('professor')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${role === 'professor' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <School size={24} />
                <span className="font-bold text-sm">Professor</span>
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full py-4 text-lg">
            Acessar Plataforma
          </Button>
        </form>
      </div>

      {/* Modal de Instruções */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between bg-indigo-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <HelpCircle size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Como usar o EduQuest IA?</h2>
              </div>
              <button 
                onClick={() => setShowInstructions(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Seção Professor */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <School className="text-indigo-600" size={24} />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Para Professores</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <BrainCircuit className="text-indigo-500 shrink-0" size={20} />
                    <p className="text-sm text-slate-600"><strong>Geração Automática:</strong> Transforme qualquer texto base em uma prova de 40 questões estilo ENEM em segundos.</p>
                  </div>
                  <div className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Printer className="text-indigo-500 shrink-0" size={20} />
                    <p className="text-sm text-slate-600"><strong>PDF e Impressão:</strong> Gere provas limpas para alunos ou gabaritos comentados para uso próprio.</p>
                  </div>
                </div>
              </div>

              {/* Seção Aluno */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="text-emerald-600" size={24} />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Para Alunos</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                    <p className="text-sm text-slate-600"><strong>Feedback Instantâneo:</strong> Resolva questões e entenda seus erros com as explicações didáticas da IA.</p>
                  </div>
                  <div className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <LayoutDashboard className="text-emerald-500 shrink-0" size={20} />
                    <p className="text-sm text-slate-600"><strong>Dashboard:</strong> Acompanhe sua média de acertos e receba insights sobre em quais matérias você precisa focar.</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4 items-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <GraduationCap className="text-amber-600" size={24} />
                </div>
                <p className="text-sm text-amber-800 leading-relaxed italic">
                  "Nosso objetivo é facilitar o acesso ao conhecimento através de materiais personalizados e feedback imediato. Bons estudos!"
                </p>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 text-center">
              <Button onClick={() => setShowInstructions(false)} className="px-12">
                Entendido, vamos começar!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
