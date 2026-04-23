import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { GitHubUser } from '../services/types';

interface PatContextValue {
  pat: string;
  user: GitHubUser | null;
  setPat: (pat: string, user: GitHubUser) => void;
  clearPat: () => void;
}

const PatContext = createContext<PatContextValue | undefined>(undefined);

const PAT_KEY = 'ghPat';
const USER_KEY = 'ghUser';

export function PatProvider({ children }: { children: ReactNode }) {
  const [pat, setPatState] = useState<string>(() => sessionStorage.getItem(PAT_KEY) ?? '');
  const [user, setUser] = useState<GitHubUser | null>(() => {
    const stored = sessionStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const setPat = useCallback((newPat: string, newUser: GitHubUser) => {
    sessionStorage.setItem(PAT_KEY, newPat);
    sessionStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setPatState(newPat);
    setUser(newUser);
  }, []);

  const clearPat = useCallback(() => {
    sessionStorage.removeItem(PAT_KEY);
    sessionStorage.removeItem(USER_KEY);
    setPatState('');
    setUser(null);
  }, []);

  return (
    <PatContext.Provider value={{ pat, user, setPat, clearPat }}>{children}</PatContext.Provider>
  );
}

export function usePatContext(): PatContextValue {
  const ctx = useContext(PatContext);
  if (!ctx) {
    throw new Error('usePatContext must be used within a PatProvider');
  }
  return ctx;
}
