import { useMemo } from 'react';
import { usePatContext } from '../../contexts/PatContext';
import { GithubService } from './GithubService';
import { SourceControlService } from './SourceControlService';

export function useSourceControlService(): SourceControlService {
  const { pat } = usePatContext();
  return useMemo(() => new GithubService(pat), [pat]);
}
