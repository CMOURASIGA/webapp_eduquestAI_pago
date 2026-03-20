
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGeminiConfig } from '../../context/GeminiConfigContext';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Menu, 
  X,
  GraduationCap,
  UserCircle,
  HelpCircle,
  LogOut,
  Settings
} from 'lucide-react';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appMode, userName, logout } = useGeminiConfig();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Nova Prova', path: '/nova-prova', icon: PlusCircle, professorOnly: true },
    { label: 'Provas Salvas', path: '/provas', icon: FileText },
    { label: 'Instruções', path: '/instrucoes', icon: HelpCircle, professorOnly: true },
    { label: 'Configurações', path: '/config-gemini', icon: Settings, professorOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.professorOnly || appMode === 'professor');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 print:bg-white">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <GraduationCap size={20} />
          </div>
          <h1 className="font-black text-xl text-slate-800 italic">EduQuest</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-0 z-40 transform transition-transform duration-300 
        md:sticky md:top-0 md:h-screen md:translate-x-0 print:hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 shadow-2xl
      `}>
        <div className="p-8 hidden md:flex flex-col items-center gap-2 border-b border-slate-800">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-2">
              <GraduationCap size={36} />
            </div>
          </div>
          <h1 className="font-black text-xl text-white italic tracking-tighter">EduQuest IA</h1>
          <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
              {appMode === 'professor' ? 'Acesso Professor' : 'Acesso Aluno'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'hover:bg-white/5 text-slate-400'}
                `}
              >
                <Icon size={20} />
                <span className="font-bold text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <UserCircle size={24} className="text-indigo-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{userName}</p>
              <p className="text-[10px] text-slate-500 truncate">{appMode === 'professor' ? 'Docente' : 'Estudante'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors text-sm font-bold"
          >
            <LogOut size={20} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-12 print:p-0">
        <div className="max-w-5xl mx-auto print:max-w-none">
          {children}
        </div>
      </main>

      {/* Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden print:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
