import React, { useState } from 'react';
import { useGeminiConfig, AIProvider } from '../context/GeminiConfigContext';
import { Button } from '../components/ui/Button';
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle, Cpu, KeyRound } from 'lucide-react';
import { testOpenAIConnection } from '../services/openaiService';

export const ConfigGeminiPage: React.FC = () => {
  const { 
    selectedModel, 
    setSelectedModel, 
    aiProvider, 
    setAiProvider,
    customApiKey,
    setCustomApiKey,
    canUseCustomApiKey,
    userProfile
  } = useGeminiConfig();

  const [model, setModel] = useState(selectedModel);
  const [provider, setProvider] = useState<AIProvider>(aiProvider);
  const [saved, setSaved] = useState(false);
  const [customKeyDraft, setCustomKeyDraft] = useState(customApiKey);
  
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [openAIResult, setOpenAIResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAiProvider(provider);
    setSelectedModel(model);

    if (canUseCustomApiKey) {
      setCustomApiKey(customKeyDraft.trim());
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    if (newProvider === 'openai') {
      setModel('gpt-4o-mini');
    } else {
      setModel('gemini-3-flash-preview');
    }
  };

  const handleTestOpenAI = async () => {
    setTestingOpenAI(true);
    setOpenAIResult(null);
    const result = await testOpenAIConnection();
    setOpenAIResult(result);
    setTestingOpenAI(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Configuracoes de IA</h1>
        <p className="text-slate-500">Configure sua integracao com Google Gemini e OpenAI.</p>
      </header>

      <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Provedor de IA Principal</h2>
        
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">
            Selecione a Inteligencia Artificial
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleProviderChange('gemini')}
              className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                provider === 'gemini' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                  : 'border-slate-200 hover:border-indigo-200 text-slate-600'
              }`}
            >
              <Cpu size={24} className={provider === 'gemini' ? 'text-indigo-600' : 'text-slate-400'} />
              <div className="text-left">
                <p className="font-bold">Google Gemini</p>
                <p className="text-xs opacity-80">Rapido e eficiente</p>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => handleProviderChange('openai')}
              className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                provider === 'openai' 
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                  : 'border-slate-200 hover:border-emerald-200 text-slate-600'
              }`}
            >
              <Cpu size={24} className={provider === 'openai' ? 'text-emerald-600' : 'text-slate-400'} />
              <div className="text-left">
                <p className="font-bold">OpenAI (ChatGPT)</p>
                <p className="text-xs opacity-80">Alta precisao</p>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <label className="block text-sm font-bold text-slate-700">
            Modelo Especifico ({provider === 'gemini' ? 'Gemini' : 'OpenAI'})
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {provider === 'gemini' ? (
              <>
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Recomendado - Rapido)</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro (Alta Qualidade)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
                <option value="gemini-flash-lite-latest">Gemini Flash Lite</option>
              </>
            ) : (
              <>
                <option value="gpt-4o-mini">GPT-4o Mini (Recomendado - Rapido e Barato)</option>
                <option value="gpt-4o">GPT-4o (Alta Qualidade)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </>
            )}
          </select>
        </div>

        <div className="space-y-2 pt-4">
          <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
            <KeyRound size={18} /> Chave da IA (Gemini ou OpenAI)
          </label>
          <p className="text-xs text-slate-500">
            Informe a sua chave de uso de IA para o sistema funcionar.
          </p>

          <input
            type="password"
            value={customKeyDraft}
            onChange={(e) => setCustomKeyDraft(e.target.value)}
            disabled={!canUseCustomApiKey}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="Cole aqui a chave da IA"
          />
        </div>

        <div className="pt-4 border-t mt-6">
          <Button type="submit" className="w-full" variant={saved ? 'secondary' : 'primary'}>
            {saved ? <><ShieldCheck size={20} /> Configuracoes Salvas!</> : 'Salvar Configuracoes'}
          </Button>
        </div>
      </form>

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Status das Conexoes</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-4">
            <AlertCircle className="text-indigo-600 shrink-0 mt-1" size={20} />
            <div className="text-sm text-indigo-800">
              <p className="font-bold mb-1">Google Gemini</p>
              <p>A chave de API do Gemini e carregada pela variavel <code>API_KEY</code> no deploy.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
            <AlertCircle className="text-slate-600 shrink-0 mt-1" size={20} />
            <div className="text-sm text-slate-700">
              <p className="font-bold mb-1">OpenAI</p>
              <p>A chave da OpenAI deve ser configurada no backend via <code>OPENAI_API_KEY</code>.</p>
            </div>
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
    </div>
  );
};
