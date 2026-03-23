
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  customApiKey: string;
  setCustomApiKey: (key: string) => void;
  canUseCustomApiKey: boolean;
  activeApiKey: string;
  apiKeySource: 'env' | 'custom' | 'none';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_PROFILE_KEY = 'eduquest-user-profile';
const AI_PROVIDER_KEY = 'eduquest-ai-provider';
const AI_MODEL_KEY = 'eduquest-ai-model';
const CUSTOM_API_KEY = 'eduquest-custom-api-key';

const SPECIAL_STUDENT_NAME = (process.env.SPECIAL_STUDENT_NAME || 'LUCAS').toLowerCase();
const SPECIAL_PROFESSOR_NAME = (process.env.SPECIAL_PROFESSOR_NAME || 'CHRISTIAN').toLowerCase();

export const GeminiConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [customApiKey, setCustomApiKeyState] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(USER_PROFILE_KEY);
    if (saved) {
      setUserProfile(JSON.parse(saved));
    }
    
    const savedProvider = localStorage.getItem(AI_PROVIDER_KEY) as AIProvider;
    if (savedProvider) {
      setAiProvider(savedProvider);
    }

    const savedModel = localStorage.getItem(AI_MODEL_KEY);
    if (savedModel) {
      setSelectedModel(savedModel);
    }

    const savedCustomKey = localStorage.getItem(CUSTOM_API_KEY);
    if (savedCustomKey) {
      setCustomApiKeyState(savedCustomKey);
    }
  }, []);

  const handleSetAiProvider = (provider: AIProvider) => {
    setAiProvider(provider);
    localStorage.setItem(AI_PROVIDER_KEY, provider);
    
    // Set default model when switching providers
    if (provider === 'openai') {
      handleSetSelectedModel('gpt-4o-mini');
    } else {
      handleSetSelectedModel('gemini-3-flash-preview');
    }
  };

  const handleSetSelectedModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem(AI_MODEL_KEY, model);
  };

  const login = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  };

  const logout = () => {
    setUserProfile(null);
    localStorage.removeItem(USER_PROFILE_KEY);
  };

  const setCustomApiKey = (key: string) => {
    setCustomApiKeyState(key);
    if (key) {
      localStorage.setItem(CUSTOM_API_KEY, key);
    } else {
      localStorage.removeItem(CUSTOM_API_KEY);
    }
  };

  const canUseCustomApiKey = useMemo(() => {
    if (!userProfile) return false;
    const normalized = userProfile.name.trim().toLowerCase();
    if (userProfile.role === 'aluno') {
      return normalized === SPECIAL_STUDENT_NAME;
    }
    if (userProfile.role === 'professor') {
      return normalized === SPECIAL_PROFESSOR_NAME;
    }
    return false;
  }, [userProfile]);

  const activeApiKey = useMemo(() => {
    if (canUseCustomApiKey && customApiKey) {
      return customApiKey;
    }
    return process.env.API_KEY || '';
  }, [canUseCustomApiKey, customApiKey]);

  const apiKeySource: AppContextType['apiKeySource'] = activeApiKey
    ? (canUseCustomApiKey && customApiKey ? 'custom' : 'env')
    : 'none';

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
      setAiProvider: handleSetAiProvider,
      customApiKey,
      setCustomApiKey,
      canUseCustomApiKey,
      activeApiKey,
      apiKeySource
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
