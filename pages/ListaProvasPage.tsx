
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Exam } from '../types/exam';
import { EmptyState } from '../components/feedback/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FileText, Search, Trash2, BookOpen, ChevronRight } from 'lucide-react';
import { serieLabels } from '../utils/seriesUtils';

export const ListaProvasPage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = () => {
    setExams(storageService.getExams().sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir esta prova?")) {
      storageService.deleteExam(id);
      loadExams();
    }
  };

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.disciplina.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (exams.length === 0) {
    return (
      <div className="py-12">
        <EmptyState 
          title="Nenhuma prova encontrada"
          description="Sua biblioteca está vazia. Comece criando novos materiais de estudo agora mesmo."
          icon={FileText}
          actionLabel="Criar Nova Prova"
          onAction={() => navigate('/nova-prova')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Provas Salvas</h1>
          <p className="text-slate-500">Explore e revise seus materiais de estudo gerados pela IA.</p>
        </div>
        <Button onClick={() => navigate('/nova-prova')}>
          Nova Prova
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Pesquisar por título ou disciplina..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredExams.map((exam) => (
          <div 
            key={exam.id}
            onClick={() => navigate(`/provas/${exam.id}`)}
            className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <Badge variant="info">{exam.disciplina}</Badge>
                <button 
                  onClick={(e) => handleDelete(exam.id, e)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                {exam.title}
              </h3>
              <p className="text-sm text-slate-400 mb-6 font-medium">
                {serieLabels[exam.serie]}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
              <div className="flex items-center gap-2 text-slate-500">
                <BookOpen size={16} />
                <span className="text-sm font-bold">{exam.questions.length} questões</span>
              </div>
              <div className="flex items-center gap-1 text-indigo-600 font-bold text-sm">
                Abrir Prova <ChevronRight size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredExams.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Nenhum resultado encontrado para "{searchTerm}".
        </div>
      )}
    </div>
  );
};
