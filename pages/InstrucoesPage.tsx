import React from 'react';
import { CheckCircle2, HelpCircle, Lightbulb, Printer, UserCircle, Wallet } from 'lucide-react';

export const InstrucoesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <HelpCircle size={24} />
          </div>
          <h1 className="text-3xl font-black text-slate-800">Instrucoes de Uso</h1>
        </div>
        <p className="text-slate-500">Guia rapido para cadastro, contratacao de plano, geracao de provas e uso por subcadastros.</p>
      </header>

      <div className="space-y-6">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3">1. Cadastro e acesso</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>O cadastro principal e unico (email + telefone + senha).</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Subcadastros de aluno sao criados em <strong>Conta</strong> e usam <strong>usuario + senha</strong>.</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Caminho no menu: <strong>Conta - Subcadastros de Aluno - Criar subcadastro</strong>.</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>O plano contratado vale para a conta principal e para seus subcadastros.</span></li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2"><Wallet size={18} /> 2. Plano, voucher e gratuito</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>O acesso gratuito inicial e permitido apenas uma vez por identidade (email/telefone).</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Se a identidade ja usou gratuito ou teve conta cancelada, novo gratuito e bloqueado.</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Planos tipo voucher podem ter limite menor de questoes por prova (ex.: 20).</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Todos os eventos de cancelamento e alteracoes de status ficam registrados em planilha.</span></li>
          </ul>
          <div className="mt-4 space-y-2 text-xs text-slate-700">
            <p><strong>FREE_ONCE - Teste Gratuito:</strong> Experimente sem custo e gere sua primeira prova. Ideal para conhecer a qualidade das questoes e o funcionamento da plataforma. Disponivel uma unica vez por conta.</p>
            <p><strong>FREE40 - Pacote Inicial:</strong> Opcao de entrada para continuar apos o teste gratuito, sem contratar pacote maior. Indicado para gerar ate 40 questoes com baixo investimento.</p>
            <p><strong>PRE100 - Pacote 120 Creditos (3 provas):</strong> Pacote com 120 creditos, equivalente a 3 provas de 40 questoes. Indicado para uso moderado com melhor custo-beneficio que o pacote inicial.</p>
            <p><strong>PRE300 - Pacote 360 Creditos (9 provas):</strong> Pacote com 360 creditos, equivalente a 9 provas de 40 questoes. Ideal para uso constante e maior volume de atividades.</p>
            <p><strong>ANUAL_GERAL - Plano Anual:</strong> Acesso continuo durante todo o ano, com previsibilidade e praticidade. Melhor opcao para uso recorrente na rotina escolar.</p>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3">3. Geracao de prova</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>O sistema usa somente OpenAI para gerar provas.</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>A quantidade de questoes segue o limite exibido no status da conta.</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Use conteudo base claro (texto colado ou OCR por imagem) para melhor qualidade das questoes.</span></li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2"><UserCircle size={18} /> 4. Cancelamentos</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Voce pode cancelar pagamento pendente de um plano.</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><span>Voce pode cancelar a conta. Nesse caso, gratuito nao sera liberado novamente para o mesmo email/telefone.</span></li>
          </ul>
          <div className="mt-4 flex items-start gap-3 text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-100">
            <Lightbulb size={20} className="shrink-0 mt-0.5" />
            <p className="text-xs">Se houver plano gratuito ativo e voce desistir de um checkout pago pendente, o gratuito continua valendo ate o fim da validade/creditos.</p>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2"><Printer size={18} /> 5. Impressao e PDF</h2>
          <p className="text-sm text-slate-600">Na prova aberta, use o botao <strong>Imprimir / PDF</strong> para gerar versao impressa com gabarito e justificativas.</p>
        </section>
      </div>
    </div>
  );
};
