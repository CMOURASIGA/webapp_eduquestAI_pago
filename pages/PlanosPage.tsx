import React, { useEffect, useMemo, useState } from 'react';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { activateFreeOnce, cancelAccount, cancelCheckout, createCheckout, fetchBillingMode, fetchPlans } from '../services/authService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AlertTriangle, CreditCard, Sparkles } from 'lucide-react';

export const PlanosPage: React.FC = () => {
  const { authToken, accountStatus, refreshAccountStatus, logout } = useGeminiConfig();
  const [plans, setPlans] = useState<any[]>([]);
  const [billingMode, setBillingMode] = useState<'pix_manual' | 'teste'>('teste');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [freeLoading, setFreeLoading] = useState(false);
  const [cancelCheckoutLoading, setCancelCheckoutLoading] = useState(false);
  const [cancelAccountLoading, setCancelAccountLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<any | null>(null);

  const isSessionError = (message?: string) => {
    const m = (message || '').toLowerCase();
    return m.includes('sessao invalida') || m.includes('sessão inválida') || m.includes('token ausente');
  };

  const forceRelogin = async () => {
    setError('Sessao invalida ou expirada. Faca login novamente.');
    await logout();
  };

  useEffect(() => {
    fetchPlans().then(setPlans).catch(() => {
      setError('Nao foi possivel carregar os planos.');
    });
  }, []);

  useEffect(() => {
    if (!authToken) return;
    fetchBillingMode(authToken).then((cfg) => setBillingMode(cfg.mode)).catch(async (err: any) => {
      if (isSessionError(err?.message)) await forceRelogin();
    });
  }, [authToken]);

  const contractPlans = useMemo(() => {
    return plans.filter((p: any) => {
      const tipo = String(p?.tipo_plano || '').toLowerCase();
      const ativo = String(p?.ativo || '').toLowerCase() === 'sim';
      if (!ativo) return false;
      if (tipo === 'prepago' || tipo === 'anual') return true;
      if (tipo === 'voucher') return true;
      return false;
    });
  }, [plans]);

  const displayPlanName = (plan: any) => {
    const tipo = String(plan?.tipo_plano || '').toLowerCase();
    if (tipo === 'anual') return 'Plano anual geral';
    return plan?.nome_plano || plan?.plano_id || 'Plano';
  };

  const displayPlanSerie = (plan: any) => {
    const tipo = String(plan?.tipo_plano || '').toLowerCase();
    if (tipo === 'anual') return 'geral';
    return plan?.serie || 'geral';
  };

  const freePlans = useMemo(() => {
    return plans.filter((p: any) => {
      const tipo = String(p?.tipo_plano || '').toLowerCase();
      if (tipo === 'gratuito') return true;
      return tipo !== 'voucher' && Number(p?.valor || 0) <= 0;
    });
  }, [plans]);

  const handleActivateFree = async () => {
    if (!authToken) return;
    setError(null);
    setNotice(null);
    setFreeLoading(true);
    try {
      const data = await activateFreeOnce(authToken);
      setNotice(data.message || 'Acesso gratuito inicial ativado.');
      await refreshAccountStatus();
    } catch (err: any) {
      if (isSessionError(err?.message)) await forceRelogin();
      else setError(err?.message || 'Falha ao ativar acesso gratuito.');
    } finally {
      setFreeLoading(false);
    }
  };

  const handleContract = async (planoId: string) => {
    if (!authToken) return;
    setError(null);
    setNotice(null);
    setLoadingPlanId(planoId);
    try {
      const data = await createCheckout(authToken, planoId);
      setCheckoutData(data.checkout || null);
      setNotice(data.releaseNotice || 'Pagamento criado. Aguardando validacao manual.');
      await refreshAccountStatus();
    } catch (err: any) {
      if (isSessionError(err?.message)) await forceRelogin();
      else setError(err?.message || 'Falha ao criar pagamento do plano.');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleCancelCheckout = async () => {
    if (!authToken) return;
    setCancelCheckoutLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await cancelCheckout(authToken, checkoutData?.pagamentoId);
      setCheckoutData(null);
      setNotice(data.message || 'Checkout pendente cancelado.');
      await refreshAccountStatus();
    } catch (err: any) {
      if (isSessionError(err?.message)) await forceRelogin();
      else setError(err?.message || 'Falha ao cancelar checkout pendente.');
    } finally {
      setCancelCheckoutLoading(false);
    }
  };

  const handleCancelAccount = async () => {
    if (!authToken) return;
    const confirmed = window.confirm('Confirma o cancelamento da conta? Esta acao bloqueia novo uso gratuito com este email/telefone.');
    if (!confirmed) return;
    setCancelAccountLoading(true);
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
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-black text-slate-800">Planos e Contratacao</h1>
        <p className="text-slate-500">Veja todos os planos disponiveis e contrate por PIX para liberar sua conta.</p>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {notice && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800">
          {notice}
        </div>
      )}

      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Seu status</h2>
        <div className="text-sm text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-2">
          <p><strong>Status da conta:</strong> {accountStatus?.statusConta || '-'}</p>
          <p><strong>Pagamento:</strong> {accountStatus?.pagamentoStatus || '-'}</p>
          <p><strong>Plano atual:</strong> {accountStatus?.planoId || '-'}</p>
          <p><strong>Creditos:</strong> {accountStatus?.creditosDisponiveis ?? 0}</p>
          <p><strong>Limite por prova:</strong> {accountStatus?.maxQuestionsPerExam || 40} questoes</p>
        </div>
        <div className="text-xs rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3">
          Pagamentos sao validados manualmente. A liberacao da conta pode levar no minimo 1 hora apos o pagamento.
        </div>
      </section>

      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="text-indigo-600" size={18} /> Acesso Gratuito Inicial
        </h2>
        <p className="text-sm text-slate-600">
          Disponivel uma unica vez por identidade (email/telefone), para testar a plataforma antes da contratacao.
        </p>
        <Button type="button" onClick={handleActivateFree} isLoading={freeLoading} variant="outline" disabled={!accountStatus?.canActivateFreeOnce}>
          Ativar acesso gratuito (uso unico)
        </Button>
        {!accountStatus?.canActivateFreeOnce && (
          <p className="text-xs text-slate-500">{accountStatus?.freeOnceBlockReason || 'Acesso gratuito ja utilizado ou conta ja ativa com creditos.'}</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Planos para contratar</h2>
        {contractPlans.length === 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-500">
            Nenhum plano contratavel disponivel. Verifique as colunas <code>tipo_plano</code> e <code>ativo</code> na aba <code>planos</code>.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contractPlans.map((plan: any) => (
            <div key={plan.plano_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">{displayPlanName(plan)}</h3>
                <Badge>{plan.plano_id}</Badge>
              </div>
              <p className="text-3xl font-black text-indigo-600">R$ {Number(plan.valor || 0).toFixed(2)}</p>
              {Number(plan.valor || 0) <= 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  Valor do plano esta 0 na planilha. Ajuste a coluna <code>valor</code> para cobranca real.
                </p>
              )}
              <div className="text-sm text-slate-600 space-y-1">
                <p><strong>Tipo:</strong> {plan.tipo_plano || '-'}</p>
                <p><strong>Creditos:</strong> {Number(plan.creditos_inclusos || 0)}</p>
                <p><strong>Validade:</strong> {Number(plan.validade_dias || 0)} dias</p>
                <p><strong>Serie:</strong> {displayPlanSerie(plan)}</p>
                {plan.descricao ? <p>{plan.descricao}</p> : null}
              </div>
              <Button
                type="button"
                onClick={() => handleContract(plan.plano_id)}
                isLoading={loadingPlanId === plan.plano_id}
                className="w-full"
              >
                <CreditCard size={16} /> Contratar plano
              </Button>
            </div>
          ))}
        </div>
      </section>

      {freePlans.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-700">Planos promocionais / gratuitos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {freePlans.map((plan: any) => (
              <div key={plan.plano_id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                <p className="font-bold text-slate-800">{plan.nome_plano || plan.plano_id}</p>
                <p>ID: {plan.plano_id}</p>
                <p>Creditos: {Number(plan.creditos_inclusos || 0)}</p>
                <p>Validade: {Number(plan.validade_dias || 0)} dias</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {checkoutData?.pix && billingMode === 'pix_manual' && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2 text-emerald-900">
          <h3 className="font-bold">Pagamento PIX gerado</h3>
          <p><strong>Valor:</strong> R$ {Number(checkoutData?.pix?.valor || 0).toFixed(2)}</p>
          <p><strong>Chave PIX:</strong> {checkoutData?.pix?.chave}</p>
          <p><strong>Favorecido:</strong> {checkoutData?.pix?.favorecido}</p>
          <p><strong>Identificador:</strong> {checkoutData?.pix?.identificador}</p>
          <Button type="button" variant="outline" onClick={() => navigator.clipboard?.writeText(checkoutData?.pix?.chave || '')}>
            Copiar chave PIX
          </Button>
          <Button type="button" variant="outline" isLoading={cancelCheckoutLoading} onClick={handleCancelCheckout}>
            Cancelar pagamento pendente
          </Button>
        </section>
      )}

      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-slate-800">Encerrar conta</h3>
        <p className="text-sm text-slate-600">Ao cancelar, a conta fica registrada na planilha e novo acesso gratuito sera bloqueado para este email/telefone.</p>
        <Button type="button" variant="outline" isLoading={cancelAccountLoading} onClick={handleCancelAccount}>
          Cancelar minha conta
        </Button>
      </section>
    </div>
  );
};
