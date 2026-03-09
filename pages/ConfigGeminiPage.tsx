
import React, { useState } from 'react';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { Button } from '../components/ui/Button';
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { testOpenAIConnection } from '../services/openaiService';

export const ConfigGeminiPage: React.FC = () => {
  // Fix: useGeminiConfig returns AppContextType which includes appMode, setAppMode, selectedModel, and setSelectedModel
  const { selectedModel, setSelectedModel } = useGeminiConfig();
  const [model, setModel] = useState(selectedModel);
  const [saved, setSaved] = useState(false);
  
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [openAIResult, setOpenAIResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Configurações de IA</h1>
        <p className="text-slate-500">Configure sua integração com as APIs do Google Gemini e OpenAI.</p>
      </header>

      <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Google Gemini</h2>
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-4">
          <AlertCircle className="text-indigo-600 shrink-0 mt-1" size={20} />
          <div className="text-sm text-indigo-800">
            <p className="font-bold mb-1">Configuração de IA</p>
            <p>A chave de API é gerenciada automaticamente pelo sistema. Você pode selecionar qual modelo de inteligência artificial deseja utilizar para gerar as questões das provas.</p>
          </div>
        </div>

        {/* Note: API Key management UI has been removed to comply with instructions that the key must be obtained exclusively from process.env.API_KEY */}

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">
            Modelo do Gemini
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="gemini-3-flash-preview">Gemini 3 Flash (Recomendado - Rápido)</option>
            <option value="gemini-3-pro-preview">Gemini 3 Pro (Alta Qualidade)</option>
            <option value="gemini-flash-latest">Gemini Flash Latest</option>
            <option value="gemini-flash-lite-latest">Gemini Flash Lite</option>
          </select>
        </div>

        <div className="pt-4">
          <Button type="submit" className="w-full" variant={saved ? 'secondary' : 'primary'}>
            {saved ? <><ShieldCheck size={20} /> Configurações Salvas!</> : 'Salvar Configurações'}
          </Button>
        </div>
      </form>

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">OpenAI</h2>
        
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
          <AlertCircle className="text-slate-600 shrink-0 mt-1" size={20} />
          <div className="text-sm text-slate-700">
            <p className="font-bold mb-1">Integração Backend</p>
            <p>A chave da OpenAI deve ser configurada no servidor (backend) através da variável de ambiente <code>OPENAI_API_KEY</code>.</p>
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
            {testingOpenAI ? 'Testando conexão...' : 'Testar Conexão com OpenAI'}
          </Button>
        </div>

        {openAIResult && (
          <div className={`p-4 rounded-xl flex items-start gap-3 ${openAIResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {openAIResult.success ? <CheckCircle2 className="shrink-0 mt-0.5" size={20} /> : <XCircle className="shrink-0 mt-0.5" size={20} />}
            <div className="text-sm">
              <p className="font-bold">{openAIResult.success ? 'Sucesso!' : 'Erro na conexão'}</p>
              <p>{openAIResult.success ? openAIResult.message : openAIResult.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
