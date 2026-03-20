
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GeminiConfigProvider, useGeminiConfig } from './context/GeminiConfigContext';
import { MainLayout } from './components/Layout/MainLayout';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { NovaProvaPage } from './pages/NovaProvaPage';
import { ListaProvasPage } from './pages/ListaProvasPage';
import { ProvaDetalhePage } from './pages/ProvaDetalhePage';
import { InstrucoesPage } from './pages/InstrucoesPage';
import { LoginPage } from './pages/LoginPage';
import { ConfigGeminiPage } from './pages/ConfigGeminiPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useGeminiConfig();
  if (!userProfile) return <LoginPage />;
  return <MainLayout>{children}</MainLayout>;
};

const App: React.FC = () => {
  return (
    <GeminiConfigProvider>
      <Router>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/nova-prova" element={
            <ProtectedRoute>
              <NovaProvaPage />
            </ProtectedRoute>
          } />
          <Route path="/provas" element={
            <ProtectedRoute>
              <ListaProvasPage />
            </ProtectedRoute>
          } />
          <Route path="/provas/:id" element={
            <ProtectedRoute>
              <ProvaDetalhePage />
            </ProtectedRoute>
          } />
          <Route path="/instrucoes" element={
            <ProtectedRoute>
              <InstrucoesPage />
            </ProtectedRoute>
          } />
          <Route path="/config-gemini" element={
            <ProtectedRoute>
              <ConfigGeminiPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </GeminiConfigProvider>
  );
};

export default App;
