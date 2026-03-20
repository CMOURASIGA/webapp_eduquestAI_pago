
import React from 'react';

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-indigo-600 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Por favor, aguarde</h3>
          <p className="text-slate-500">{message}</p>
        </div>
        <p className="text-xs text-slate-400 italic">Isso pode levar alguns minutos para gerar 40 questões detalhadas.</p>
      </div>
    </div>
  );
};
