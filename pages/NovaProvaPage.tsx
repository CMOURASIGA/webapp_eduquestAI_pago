import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SerieEscolar } from '../types/exam';
import { serieLabels } from '../utils/seriesUtils';
import { getSubjectsForSerie } from '../utils/subjectUtils';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { generateExamWithOpenAI } from '../services/openaiService';
import { storageService } from '../services/storageService';
import { extractTextFromImage } from '../services/ocrService';
import { activateFreeOnce, cancelAccount, cancelCheckout, createCheckout, fetchAccountStatus, fetchBillingMode, fetchPlans } from '../services/authService';
import { Button } from '../components/ui/Button';
import { LoadingOverlay } from '../components/feedback/LoadingOverlay';
import { BrainCircuit, Target, FileText, AlertTriangle } from 'lucide-react';

export const NovaProvaPage: React.FC = () => {
  const { selectedModel, authToken, accountStatus, refreshAccountStatus, logout } = useGeminiConfig();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancelCheckoutLoading, setCancelCheckoutLoading] = useState(false);
  const [cancelAccountLoading, setCancelAccountLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('PRE100');
  const [lastCheckout, setLastCheckout] = useState<any | null>(null);
  const [releaseNotice, setReleaseNotice] = useState<string | null>(null);
  const [billingMode, setBillingMode] = useState<'pix_manual' | 'teste'>('teste');
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const [buildVersion, setBuildVersion] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    serie: '6_ano_fundamental' as SerieEscolar,
    disciplina: '',
    objetivo: '',
    conteudoBase: '',
    nivelDificuldade: 'media' as 'baixa' | 'media' | 'alta'
  });

  const questionsPerExam = Number(accountStatus?.maxQuestionsPerExam || 40);

  const isSessionError = (message?: string) => {
    const m = (message || '').toLowerCase();
    return m.includes('sessao invalida') || m.includes('sessão inválida') || m.includes('token ausente');
  };

  const forceRelogin = async () => {
    setError('Sessao invalida ou expirada. Faca login novamente.');
    await logout();
  };

  const availableSubjects = getSubjectsForSerie(formData.serie);
  const contractPlans = plans.filter((p: any) => {
    const tipo = String(p?.tipo_plano || '').toLowerCase();
    const ativo = String(p?.ativo || '').toLowerCase() === 'sim';
    if (!ativo) return false;
    if (tipo === 'prepago' || tipo === 'anual' || tipo === 'voucher') return true;
    return Number(p?.valor || 0) > 0;
  });

  useEffect(() => {
    if (!availableSubjects.includes(formData.disciplina)) {
      setFormData(prev => ({ ...prev, disciplina: availableSubjects[0] }));
    }
  }, [formData.serie]);

  useEffect(() => {
    fetchPlans().then((list) => {
      setPlans(list);
      const availableForContract = (list || []).filter((p: any) => {
        const tipo = String(p?.tipo_plano || '').toLowerCase();
        const ativo = String(p?.ativo || '').toLowerCase() === 'sim';
        return ativo && (tipo === 'prepago' || tipo === 'anual' || tipo === 'voucher');
      });
      if (availableForContract.length > 0 && !availableForContract.find((p: any) => p.plano_id === selectedPlanId)) {
        setSelectedPlanId(availableForContract[0].plano_id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authToken) return;
    fetchBillingMode(authToken).then((cfg) => {
      setBillingMode(cfg.mode);
      setSimulationEnabled(Boolean(cfg.simulationEnabled));
    }).catch(async (err: any) => {
      if (isSessionError(err?.message)) await forceRelogin();
    });
  }, [authToken]);

  useEffect(() => {
    fetch('/api/health/full')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.buildVersion) setBuildVersion(String(data.buildVersion));
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) {
      setError('Sessao invalida. Faca login novamente.');
      return;
    }

    try {
      const liveStatus = await fetchAccountStatus(authToken);
      if (!liveStatus.canGenerate) {
        setError(`Conta bloqueada para geracao. Motivos: ${liveStatus.blockReasons.join(' | ')}`);
        await refreshAccountStatus();
        return;
      }
    } catch (err: any) {
      if (isSessionError(err?.message)) {
        await forceRelogin();
        return;
      }
      // Se a consulta de status falhar, segue para tentativa de geracao e usa erro da API.
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = {
        ...formData,
        conteudoBase: [formData.conteudoBase],
        modelName: selectedModel,
        authToken,
        questionCount: questionsPerExam,
      };

      const generated = await generateExamWithOpenAI(params as any);

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
      await refreshAccountStatus();
      navigate(`/provas/${newExam.id}`);
    } catch (err: any) {
      if (isSessionError(err?.message)) {
        await forceRelogin();
      } else {
        setError(`Erro ao gerar prova com OpenAI: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(null);
    setIsExtracting(true);
    try {
      const text = await extractTextFromImage(file);
      setFormData(prev => ({ ...prev, conteudoBase: text }));
    } catch (err: any) {
      setOcrError(err.message || 'Nao foi possivel extrair texto da imagem.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleActivateFreeOnce = async () => {
    if (!authToken) return;
    setBillingLoading(true);
    setError(null);
    try {
      const data = await activateFreeOnce(authToken);
      setReleaseNotice(data.message || 'Acesso gratuito inicial ativado para uma unica execucao.');
      await refreshAccountStatus();
    } catch (err: any) {
      if (isSessionError(err?.message)) {
        await forceRelogin();
      } else {
        setError(err.message || 'Falha ao ativar acesso gratuito.');
      }
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCreateCheckout = async () => {
    if (!authToken || !selectedPlanId) return;
    setBillingLoading(true);
    setError(null);
    try {
      const data = await createCheckout(authToken, selectedPlanId);
      setLastCheckout(data.checkout);
      setReleaseNotice(data.releaseNotice || 'Pagamento recebido entra em analise manual. Prazo minimo para liberacao: 1 hora.');
      if (data.billingMode) {
        setBillingMode(data.billingMode);
        setSimulationEnabled(Boolean(data.checkout?.simulationEnabled));
      }
    } catch (err: any) {
      if (isSessionError(err?.message)) {
        await forceRelogin();
      } else {
        setError(err.message || 'Falha ao criar checkout.');
      }
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!lastCheckout?.asaasPaymentId) return;
    setBillingLoading(true);
    try {
      const response = await fetch('/api/billing/webhook/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asaas_payment_id: lastCheckout.asaasPaymentId,
          status: 'confirmado',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || 'Falha no webhook');
      await refreshAccountStatus();
      setLastCheckout(null);
      setReleaseNotice(null);
    } catch (err: any) {
      if (isSessionError(err?.message)) {
        await forceRelogin();
      } else {
        setError(err.message || 'Falha ao registrar pagamento.');
      }
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelPendingCheckout = async () => {
    if (!authToken) return;
    setCancelCheckoutLoading(true);
    setError(null);
    try {
      const data = await cancelCheckout(authToken, lastCheckout?.pagamentoId);
      setReleaseNotice(data.message || 'Checkout pendente cancelado.');
      setLastCheckout(null);
      await refreshAccountStatus();
    } catch (err: any) {
      if (isSessionError(err?.message)) await forceRelogin();
      else setError(err?.message || 'Falha ao cancelar checkout.');
    } finally {
      setCancelCheckoutLoading(false);
    }
  };

  const handleCancelAccount = async () => {
    if (!authToken) return;
    const confirmed = window.confirm('Confirma o cancelamento da conta? Esta acao bloqueia novo uso gratuito com este email/telefone.');
    if (!confirmed) return;
    setCancelAccountLoading(true);
    setError(null);
    try {
      await cancelAccount(authToken);
      await logout();
    } catch (err: any) {
      if (isSessionError(err?.message)) await forceRelogin();
      else setError(err?.message || 'Falha ao cancelar conta.');
    } finally {
      setCancelAccountLoading(false);
    }
  };

  return (
    <div className="pb-12">
      {isLoading && <LoadingOverlay message="A IA (OpenAI) esta elaborando as questoes..." />}

      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Criar Material de Estudo</h1>
          <p className="text-slate-500">Simulado de {questionsPerExam} questoes com controle de creditos.</p>
          {buildVersion && (
            <p className="text-xs text-slate-400 mt-1">Build: {buildVersion}</p>
          )}
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
              <h2 className="text-xl font-bold text-slate-800">Conteudo Base</h2>
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <p className="text-sm text-slate-500">Cole texto ou envie imagem para OCR.</p>
              <label className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 cursor-pointer">
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} disabled={isExtracting || isLoading} />
                <span className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition">{isExtracting ? 'Extraindo...' : 'Upload de imagem'}</span>
              </label>
            </div>
            <textarea
              required
              value={formData.conteudoBase}
              onChange={(e) => setFormData({ ...formData, conteudoBase: e.target.value })}
              className="flex-1 w-full min-h-[400px] p-6 rounded-2xl border-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 font-serif leading-relaxed"
              placeholder="Cole aqui o conteudo base..."
            />
            {ocrError && <p className="mt-2 text-sm text-red-600">{ocrError}</p>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-3">
            <h3 className="text-sm font-black uppercase text-slate-700">Status da Conta</h3>
            <div className="text-sm text-slate-600 space-y-1">
              <p><strong>Status:</strong> {accountStatus?.statusConta || '-'}</p>
              <p><strong>Pagamento:</strong> {accountStatus?.pagamentoStatus || '-'}</p>
              <p><strong>Creditos:</strong> {accountStatus?.creditosDisponiveis ?? 0}</p>
              <p><strong>Pode gerar:</strong> {accountStatus?.canGenerate ? 'Sim' : 'Nao'}</p>
              <p><strong>Limite por prova:</strong> {questionsPerExam} questoes</p>
            </div>
            <div className="text-xs rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3">
              Pagamentos sao validados manualmente. A liberacao da conta pode levar no minimo 1 hora apos o pagamento.
            </div>
            <div className="text-xs rounded-xl border border-sky-200 bg-sky-50 text-sky-800 p-3">
              Cada identidade (email/telefone) pode ativar acesso gratuito inicial uma unica vez. Reuso exige plano pago.
            </div>
            {releaseNotice && (
              <div className="text-xs rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 p-3">
                {releaseNotice}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Button
                type="button"
                onClick={handleActivateFreeOnce}
                isLoading={billingLoading}
                variant="outline"
                disabled={!accountStatus?.canActivateFreeOnce}
              >
                Ativar acesso gratuito inicial (1 execucao)
              </Button>
              {!accountStatus?.canActivateFreeOnce && accountStatus?.freeOnceBlockReason && (
                <p className="text-[11px] text-amber-700">{accountStatus.freeOnceBlockReason}</p>
              )}

              <label className="block text-xs font-black uppercase text-slate-500">
                Plano para contratacao
              </label>
              {contractPlans.length > 0 ? (
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                >
                  {contractPlans.map((p: any) => (
                    <option key={p.plano_id} value={p.plano_id}>{p.plano_id} - R$ {Number(p.valor || 0).toFixed(2)}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500">Nenhum plano pago disponivel.</p>
              )}
              <Button
                type="button"
                onClick={handleCreateCheckout}
                isLoading={billingLoading}
                variant="outline"
                disabled={contractPlans.length === 0}
              >
                Gerar pagamento PIX do plano
              </Button>
              <Button
                type="button"
                onClick={handleCancelPendingCheckout}
                isLoading={cancelCheckoutLoading}
                variant="outline"
                disabled={!lastCheckout}
              >
                Cancelar pagamento pendente
              </Button>
              <Button
                type="button"
                onClick={handleCancelAccount}
                isLoading={cancelAccountLoading}
                variant="outline"
              >
                Cancelar conta
              </Button>
              {lastCheckout?.pix && (
                <div className="text-xs rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 p-3 space-y-2">
                  <p><strong>Valor:</strong> R$ {Number(lastCheckout?.pix?.valor || 0).toFixed(2)}</p>
                  <p><strong>Chave PIX:</strong> {lastCheckout?.pix?.chave}</p>
                  <p><strong>Favorecido:</strong> {lastCheckout?.pix?.favorecido}</p>
                  <p><strong>Identificador:</strong> {lastCheckout?.pix?.identificador}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigator.clipboard?.writeText(lastCheckout?.pix?.chave || '')}
                  >
                    Copiar chave PIX
                  </Button>
                </div>
              )}
              {simulationEnabled && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500">Somente homologacao: registrar pagamento manual sem gateway.</div>
                  <Button type="button" onClick={handleSimulatePayment} isLoading={billingLoading} variant="outline" disabled={!lastCheckout}>
                    Registrar pagamento manual (homologacao)
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Target className="text-indigo-600" size={20} />
              <h2 className="text-xl font-bold text-slate-800">Parametros</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Titulo da Prova</label>
                <input required type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Simulado de Biomas Brasileiros" />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Serie / Ano</label>
                <select value={formData.serie} onChange={(e) => setFormData({ ...formData, serie: e.target.value as SerieEscolar })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none">
                  {Object.entries(serieLabels).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Disciplina</label>
                <select value={formData.disciplina} onChange={(e) => setFormData({ ...formData, disciplina: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none">
                  {availableSubjects.map((subject) => (<option key={subject} value={subject}>{subject}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Objetivo Pedagogico</label>
                <textarea required rows={2} value={formData.objetivo} onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="O que o aluno deve aprender com esta prova?" />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Nivel de Dificuldade</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['baixa', 'media', 'alta'].map((lvl) => (
                    <button key={lvl} type="button" onClick={() => setFormData({ ...formData, nivelDificuldade: lvl as any })} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.nivelDificuldade === lvl ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full py-5 text-xl shadow-xl" isLoading={isLoading} disabled={!accountStatus?.canGenerate}>
              Gerar Prova com IA
            </Button>
          </section>
        </div>
      </form>
    </div>
  );
};
