import { useCallback, useState } from 'react';
import { usePatContext } from '../contexts/PatContext';
import { GithubService } from '../services/source-control/GithubService';
import { GitHubUser } from '../services/types';

interface UseUserAvatarResult {
  isConnected: boolean;
  user: GitHubUser | null;
  validating: boolean;
  error: string | null;
  submitPat: (pat: string) => Promise<boolean>;
  clearError: () => void;
}

export function useUserAvatar(): UseUserAvatarResult {
  const { pat, user, setPat } = usePatContext();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPat = useCallback(
    async (newPat: string): Promise<boolean> => {
      setValidating(true);
      setError(null);
      try {
        const svc = new GithubService(newPat);
        const ghUser = await svc.validatePat();
        setPat(newPat, ghUser);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setValidating(false);
      }
    },
    [setPat],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isConnected: !!pat,
    user,
    validating,
    error,
    submitPat,
    clearError,
  };
}
