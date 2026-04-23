import React, { useState } from 'react';
import { useGeminiConfig } from '../context/GeminiConfigContext';
import { Button } from '../components/ui/Button';
import { GraduationCap, UserCircle, AlertTriangle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, register } = useGeminiConfig();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          role: 'professor',
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Falha de autenticacao.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="bg-indigo-600 p-8 text-center text-white">
          <div className="inline-flex p-3 bg-white/20 rounded-2xl mb-4">
            <GraduationCap size={48} />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter">EduQuest IA</h1>
          <p className="opacity-80 text-sm mt-2">Acesso com controle de pagamento e creditos</p>
        </div>

        <div className="p-6 pb-0">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 rounded-lg text-sm font-bold ${mode === 'login' ? 'bg-white text-indigo-600 shadow' : 'text-slate-600'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 rounded-lg text-sm font-bold ${mode === 'register' ? 'bg-white text-indigo-600 shadow' : 'text-slate-600'}`}
            >
              Cadastrar
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Nome</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Telefone (DDD + numero)</label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1">{mode === 'login' ? 'Email ou usuario' : 'Email'}</label>
            <input
              required
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder={mode === 'login' ? 'email ou usuario do subcadastro' : 'voce@email.com'}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1">Senha</label>
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Minimo 6 caracteres"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full py-4 text-lg" isLoading={isLoading}>
            <UserCircle size={18} /> {mode === 'login' ? 'Entrar no sistema' : 'Criar conta'}
          </Button>
        </form>
      </div>
    </div>
  );
};
