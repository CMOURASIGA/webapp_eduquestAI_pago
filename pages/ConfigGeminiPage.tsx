import React, { useEffect, useState } from 'react';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { Button } from '../components/ui/Button';
import { AlertCircle, CheckCircle2, XCircle, Users, UserPlus, Trash2 } from 'lucide-react';
import { createSubaccount, deleteSubaccount, fetchSubaccounts, Subaccount } from '../services/authService';
import { testOpenAIConnection } from '../services/openaiService';

export const ConfigGeminiPage: React.FC = () => {
  const { selectedModel, setSelectedModel, authToken, userProfile } = useGeminiConfig();

  const [model, setModel] = useState(selectedModel);
  const [saved, setSaved] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [openAIResult, setOpenAIResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const [subaccounts, setSubaccounts] = useState<Subaccount[]>([]);
  const [subName, setSubName] = useState('');
  const [subUsername, setSubUsername] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const isMainOwner = userProfile?.role === 'professor';

  const loadSubaccounts = async () => {
    if (!authToken || !isMainOwner) return;
    setLoadingSubs(true);
    setSubError(null);
    try {
      const list = await fetchSubaccounts(authToken);
      setSubaccounts(list);
    } catch (err: any) {
      setSubError(err?.message || 'Falha ao carregar subcadastros.');
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    loadSubaccounts();
  }, [authToken, isMainOwner]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestOpenAI = async () => {
    setTestingOpenAI(true);
    setOpenAIResult(null);
    const result = await testOpenAIConnection(authToken);
    setOpenAIResult(result);
    setTestingOpenAI(false);
  };

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setSubError(null);
    try {
      await createSubaccount(authToken, {
        name: subName.trim(),
        username: subUsername.trim(),
        password: subPassword,
      });
      setSubName('');
      setSubUsername('');
      setSubPassword('');
      await loadSubaccounts();
    } catch (err: any) {
      setSubError(err?.message || 'Falha ao criar subcadastro.');
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!authToken) return;
    try {
      await deleteSubaccount(authToken, id);
      await loadSubaccounts();
    } catch (err: any) {
      setSubError(err?.message || 'Falha ao remover subcadastro.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Configuracoes de IA</h1>
        <p className="text-slate-500">A plataforma usa somente OpenAI para gerar provas.</p>
      </header>

      <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Modelo OpenAI</h2>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-bold text-slate-700">Modelo</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
            <option value="gpt-4.1">GPT-4.1</option>
          </select>
        </div>

        <div className="pt-4 border-t mt-6">
          <Button type="submit" className="w-full" variant={saved ? 'secondary' : 'primary'}>
            {saved ? 'Configuracoes Salvas!' : 'Salvar Configuracoes'}
          </Button>
        </div>
      </form>

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Status da Conexao</h2>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
          <AlertCircle className="text-slate-600 shrink-0 mt-1" size={20} />
          <div className="text-sm text-slate-700">
            <p className="font-bold mb-1">OpenAI</p>
            <p>A chave da OpenAI e centralizada no backend via <code>OPENAI_API_KEY</code> (Vercel).</p>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            onClick={handleTestOpenAI}
            disabled={testingOpenAI}
            className="w-full"
            variant="secondary"
          >
            {testingOpenAI ? 'Testando conexao...' : 'Testar Conexao com OpenAI'}
          </Button>
        </div>

        {openAIResult && (
          <div className={`p-4 rounded-xl flex items-start gap-3 ${openAIResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {openAIResult.success ? <CheckCircle2 className="shrink-0 mt-0.5" size={20} /> : <XCircle className="shrink-0 mt-0.5" size={20} />}
            <div className="text-sm">
              <p className="font-bold">{openAIResult.success ? 'Sucesso!' : 'Erro na conexao'}</p>
              <p>{openAIResult.success ? openAIResult.message : openAIResult.error}</p>
            </div>
          </div>
        )}
      </div>

      {isMainOwner && (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Users size={20} /> Subcadastros de Aluno</h2>

          <form onSubmit={handleCreateSub} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="px-4 py-3 rounded-xl border border-slate-200"
              placeholder="Nome do aluno"
            />
            <input
              required
              value={subUsername}
              onChange={(e) => setSubUsername(e.target.value)}
              className="px-4 py-3 rounded-xl border border-slate-200"
              placeholder="Usuario do aluno"
            />
            <input
              required
              minLength={6}
              type="password"
              value={subPassword}
              onChange={(e) => setSubPassword(e.target.value)}
              className="px-4 py-3 rounded-xl border border-slate-200"
              placeholder="Senha (min. 6)"
            />
            <div className="md:col-span-3">
              <Button type="submit" className="w-full"><UserPlus size={16} /> Criar subcadastro</Button>
            </div>
          </form>

          {subError && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{subError}</div>
          )}

          <div className="space-y-2">
            {loadingSubs && <p className="text-sm text-slate-500">Carregando subcadastros...</p>}
            {!loadingSubs && subaccounts.length === 0 && <p className="text-sm text-slate-500">Nenhum subcadastro criado.</p>}
            {subaccounts.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="font-bold text-slate-800">{sub.name}</p>
                  <p className="text-xs text-slate-500">Usuario: {sub.username}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => handleDeleteSub(sub.id)}>
                  <Trash2 size={14} /> Remover
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
