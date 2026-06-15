import { TOKEN_KEY } from '../types';
import { GithubService } from './GithubService';
import { SourceControlService } from './SourceControlService';

const instance = new GithubService(() => sessionStorage.getItem(TOKEN_KEY) || '');

export function useSourceControlService(): SourceControlService {
  return instance;
}
