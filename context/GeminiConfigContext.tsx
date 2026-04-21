import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AppMode, UserProfile } from '../types/exam';
import {
  AccountStatus,
  fetchAccountStatus,
  fetchMe,
  getStoredToken,
  loginWithBackend,
  logoutFromBackend,
  registerWithBackend,
  setStoredToken,
} from '../services/authService';

export type AIProvider = 'gemini' | 'openai';

interface AppContextType {
  appMode: AppMode;
  userName: string;
  userProfile: UserProfile | null;
  accountStatus: AccountStatus | null;
  authToken: string;
  authLoading: boolean;
  login: (params: { email: string; password: string }) => Promise<void>;
  register: (params: { name: string; email: string; password: string; role: AppMode }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccountStatus: () => Promise<void>;
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
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');
  const [customApiKey, setCustomApiKeyState] = useState('');

  useEffect(() => {
    const savedProvider = localStorage.getItem(AI_PROVIDER_KEY) as AIProvider;
    if (savedProvider) setAiProvider(savedProvider);

    const savedModel = localStorage.getItem(AI_MODEL_KEY);
    if (savedModel) setSelectedModel(savedModel);

    const savedCustomKey = localStorage.getItem(CUSTOM_API_KEY);
    if (savedCustomKey) setCustomApiKeyState(savedCustomKey);

    const savedProfile = localStorage.getItem(USER_PROFILE_KEY);
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch {
        localStorage.removeItem(USER_PROFILE_KEY);
      }
    }

    const token = getStoredToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    setAuthToken(token);
    fetchMe(token)
      .then(({ user, account }) => {
        const profile: UserProfile = { name: user.name, role: user.role };
        setUserProfile(profile);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
        setAccountStatus(account);
      })
      .catch(() => {
        setStoredToken('');
        setAuthToken('');
        setUserProfile(null);
        setAccountStatus(null);
        localStorage.removeItem(USER_PROFILE_KEY);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const handleSetAiProvider = (provider: AIProvider) => {
    setAiProvider(provider);
    localStorage.setItem(AI_PROVIDER_KEY, provider);
    if (provider === 'openai') handleSetSelectedModel('gpt-4o-mini');
    else handleSetSelectedModel('gemini-2.5-flash');
  };

  const handleSetSelectedModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem(AI_MODEL_KEY, model);
  };

  const login = async ({ email, password }: { email: string; password: string }) => {
    const data = await loginWithBackend(email, password);
    const profile: UserProfile = { name: data.user.name, role: data.user.role };
    setStoredToken(data.token);
    setAuthToken(data.token);
    setUserProfile(profile);
    setAccountStatus(data.account);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  };

  const register = async ({ name, email, password, role }: { name: string; email: string; password: string; role: AppMode }) => {
    const data = await registerWithBackend({ name, email, password, role });
    const profile: UserProfile = { name: data.user.name, role: data.user.role };
    setStoredToken(data.token);
    setAuthToken(data.token);
    setUserProfile(profile);
    setAccountStatus(data.account);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  };

  const logout = async () => {
    try {
      if (authToken) await logoutFromBackend(authToken);
    } finally {
      setStoredToken('');
      setAuthToken('');
      setUserProfile(null);
      setAccountStatus(null);
      localStorage.removeItem(USER_PROFILE_KEY);
    }
  };

  const refreshAccountStatus = async () => {
    if (!authToken) return;
    const status = await fetchAccountStatus(authToken);
    setAccountStatus(status);
  };

  const setCustomApiKey = (key: string) => {
    setCustomApiKeyState(key);
    if (key) localStorage.setItem(CUSTOM_API_KEY, key);
    else localStorage.removeItem(CUSTOM_API_KEY);
  };

  const canUseCustomApiKey = useMemo(() => {
    if (!userProfile) return false;
    const normalized = userProfile.name.trim().toLowerCase();
    if (userProfile.role === 'aluno') return normalized === SPECIAL_STUDENT_NAME;
    if (userProfile.role === 'professor') return normalized === SPECIAL_PROFESSOR_NAME;
    return false;
  }, [userProfile]);

  const activeApiKey = useMemo(() => {
    if (canUseCustomApiKey && customApiKey) return customApiKey;
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
      accountStatus,
      authToken,
      authLoading,
      login,
      register,
      logout,
      refreshAccountStatus,
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
    throw new Error('useGeminiConfig must be used within a GeminiConfigProvider');
  }
  return context;
};
