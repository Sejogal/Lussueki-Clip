import {
  ApiError,
  AuthSession,
  getHistory,
  HistoryItem,
  getStoredSession,
  registerWatch as sendWatch,
  signIn as requestSignIn,
  signOut as removeStoredSession,
  signUp as requestSignUp,
  WatchPayload,
} from '@/services/auth';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  recordWatch: (payload: WatchPayload) => Promise<void>;
  history: HistoryItem[];
  refreshHistory: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    getStoredSession()
      .then(setSession)
      .finally(() => setIsLoading(false));
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!session) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await getHistory(session.accessToken));
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setHistory([]);
    }
  }, [session]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSession(await requestSignIn(email.trim(), password));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setSession(await requestSignUp(name.trim(), email.trim(), password));
  }, []);

  const signOut = useCallback(async () => {
    await removeStoredSession();
    setSession(null);
  }, []);

  const recordWatch = useCallback(
    async (payload: WatchPayload) => {
      if (!session) return;
      try {
        await sendWatch(session.accessToken, payload);
        await refreshHistory();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await removeStoredSession();
          setSession(null);
        }
        throw error;
      }
    },
    [refreshHistory, session]
  );

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut, recordWatch, history, refreshHistory }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
