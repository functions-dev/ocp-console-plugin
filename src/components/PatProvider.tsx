import { useState, useEffect, useCallback, ReactNode } from 'react';
import { PatContext, PatContextValue } from '../hooks/usePatContext';
import { useSourceControlService } from '../services/source-control/useSourceControlService';

const PAT_KEY = 'faas-gh-pat';
const MODAL_SHOWN_KEY = 'faas-gh-pat-modal-shown';

export function PatProvider({ children }: { children: ReactNode }) {
  const service = useSourceControlService();
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedPat = sessionStorage.getItem(PAT_KEY);
    if (!storedPat) return;

    service
      .init(storedPat)
      .then((name) => {
        setIsConnected(true);
        setUsername(name);
      })
      .catch(() => {
        sessionStorage.removeItem(PAT_KEY);
      });
  }, [service]);

  const openModal = useCallback(() => {
    setError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    sessionStorage.setItem(MODAL_SHOWN_KEY, 'true');
  }, []);

  const submitPat = useCallback(
    async (pat: string) => {
      setError(null);
      try {
        const name = await service.init(pat);
        sessionStorage.setItem(PAT_KEY, pat);
        setIsConnected(true);
        setUsername(name);
        setIsModalOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid token');
      }
    },
    [service],
  );

  const value: PatContextValue = {
    isConnected,
    username,
    isModalOpen,
    openModal,
    closeModal,
    submitPat,
    error,
  };

  return <PatContext.Provider value={value}>{children}</PatContext.Provider>;
}

export { MODAL_SHOWN_KEY };
