
import React from 'react';
import { 
  PlusCircle, 
  FileText, 
  UserCircle, 
  Printer, 
  BrainCircuit, 
  Lightbulb,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

export const InstrucoesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <HelpCircle size={24} />
          </div>
          <h1 className="text-3xl font-black text-slate-800">Instruções de Uso</h1>
        </div>
        <p className="text-slate-500">Aprenda a tirar o máximo proveito do EduQuest IA para criar materiais de estudo incríveis.</p>
      </header>

      <div className="space-y-8">
        {/* Passo 1: Geração */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                Como Gerar uma Prova
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">
                No menu lateral, clique em <strong className="text-indigo-600">"Nova Prova"</strong>. Você será levado a um formulário onde definirá os parâmetros pedagógicos (Série, Disciplina, Objetivo) e, o mais importante: o <strong className="text-slate-800">Conteúdo Base</strong>.
              </p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
                <BrainCircuit className="text-indigo-400 shrink-0" size={20} />
                <p className="text-sm text-slate-500 italic">
                  A IA usará o texto colado para extrair conceitos e criar 40 questões exclusivas no estilo ENEM.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Passo 2: O Conteúdo Base */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                Dicas para o Conteúdo Base
              </h2>
              <ul className="space-y-3">
                <li className="flex gap-2 text-slate-600 text-sm">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Qualidade sobre Quantidade:</strong> Textos bem estruturados com introdução, desenvolvimento e conclusão geram questões melhores.</span>
                </li>
                <li className="flex gap-2 text-slate-600 text-sm">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Tópicos:</strong> Você pode usar listas de tópicos ou resumos de capítulos.</span>
                </li>
                <li className="flex gap-2 text-slate-600 text-sm">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Contextualização:</strong> A IA tentará criar enunciados que relacionam o conteúdo com situações do cotidiano.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Passo 3: Modos Professor vs Aluno */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                Modo Professor e Modo Aluno
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">
                No final da barra lateral, você encontrará um seletor de modo.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50">
                  <h4 className="font-bold text-indigo-700 flex items-center gap-2 mb-2">
                    <UserCircle size={18} /> Modo Professor
                  </h4>
                  <p className="text-xs text-indigo-600">Visualiza a prova completa, com todas as respostas corretas destacadas e as explicações pedagógicas visíveis.</p>
                </div>
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50">
                  <h4 className="font-bold text-emerald-700 flex items-center gap-2 mb-2">
                    <PlusCircle size={18} /> Modo Aluno
                  </h4>
                  <p className="text-xs text-emerald-600">A prova torna-se interativa. O aluno responde questão por questão e recebe feedback instantâneo com a explicação do erro/acerto.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Passo 4: Impressão e PDF */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                Imprimir e Salvar PDF
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">
                Ao abrir qualquer prova salva, utilize o botão <strong className="text-indigo-600 flex inline-flex items-center gap-1"><Printer size={14} /> Imprimir / PDF</strong> no topo da página.
              </p>
              <div className="flex items-start gap-3 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                <Lightbulb size={24} className="shrink-0" />
                <p className="text-xs font-medium">
                  <strong>Dica de Mestre:</strong> Se estiver no Modo Professor, o PDF gerado será um <strong>Gabarito Comentado</strong>. Se estiver no Modo Aluno (sem responder), o PDF será a <strong>Prova Limpa</strong> para aplicação em sala de aula.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
