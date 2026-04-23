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

export type AIProvider = 'openai';

interface AppContextType {
  appMode: AppMode;
  userName: string;
  userProfile: UserProfile | null;
  accountStatus: AccountStatus | null;
  authToken: string;
  authLoading: boolean;
  login: (params: { email: string; password: string }) => Promise<void>;
  register: (params: { name: string; email: string; password: string; phone: string; role: AppMode }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccountStatus: () => Promise<void>;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  aiProvider: AIProvider;
  setAiProvider: (_provider: AIProvider) => void;
  activeApiKey: string;
  apiKeySource: 'env' | 'none';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_PROFILE_KEY = 'eduquest-user-profile';
const AI_MODEL_KEY = 'eduquest-ai-model';

export const GeminiConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

  useEffect(() => {
    const savedModel = localStorage.getItem(AI_MODEL_KEY);
    if (savedModel) setSelectedModel(savedModel);

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

  const register = async ({ name, email, password, phone, role }: { name: string; email: string; password: string; phone: string; role: AppMode }) => {
    const data = await registerWithBackend({ name, email, password, phone, role });
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

  const activeApiKey = useMemo(() => '', []);
  const apiKeySource: AppContextType['apiKeySource'] = 'none';

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
      aiProvider: 'openai',
      setAiProvider: () => {},
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
