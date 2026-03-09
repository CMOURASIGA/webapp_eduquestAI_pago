
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppMode, UserProfile } from '../types/exam';

export type AIProvider = 'gemini' | 'openai';

interface AppContextType {
  appMode: AppMode;
  userName: string;
  userProfile: UserProfile | null;
  login: (profile: UserProfile) => void;
  logout: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  aiProvider: AIProvider;
  setAiProvider: (provider: AIProvider) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const GeminiConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');

  useEffect(() => {
    const saved = localStorage.getItem('eduquest-user-profile');
    if (saved) {
      setUserProfile(JSON.parse(saved));
    }
    
    const savedProvider = localStorage.getItem('eduquest-ai-provider') as AIProvider;
    if (savedProvider) {
      setAiProvider(savedProvider);
    }

    const savedModel = localStorage.getItem('eduquest-ai-model');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  const handleSetAiProvider = (provider: AIProvider) => {
    setAiProvider(provider);
    localStorage.setItem('eduquest-ai-provider', provider);
    
    // Set default model when switching providers
    if (provider === 'openai') {
      handleSetSelectedModel('gpt-4o-mini');
    } else {
      handleSetSelectedModel('gemini-3-flash-preview');
    }
  };

  const handleSetSelectedModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('eduquest-ai-model', model);
  };

  const login = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('eduquest-user-profile', JSON.stringify(profile));
  };

  const logout = () => {
    setUserProfile(null);
    localStorage.removeItem('eduquest-user-profile');
  };

  return (
    <AppContext.Provider value={{ 
      appMode: userProfile?.role || 'professor', 
      userName: userProfile?.name || '',
      userProfile,
      login,
      logout,
      selectedModel, 
      setSelectedModel: handleSetSelectedModel,
      aiProvider,
      setAiProvider: handleSetAiProvider
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useGeminiConfig = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useGeminiConfig must be used within a GeminiConfigProvider");
  }
  return context;
};
