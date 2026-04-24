import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { createSubaccount, deleteSubaccount, fetchSubaccounts, Subaccount } from '../services/authService';

export const ContaPage: React.FC = () => {
  const { authToken, userProfile } = useGeminiConfig();
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

  if (!isMainOwner) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Conta</h1>
          <p className="text-slate-600 text-sm">Apenas a conta principal de professor pode gerenciar subcadastros.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Conta</h1>
        <p className="text-slate-500">Gerencie os subcadastros de aluno vinculados a esta conta principal.</p>
      </header>

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
    </div>
  );
};
