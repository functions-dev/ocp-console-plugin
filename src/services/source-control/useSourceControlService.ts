import { GithubService } from './GithubService';
import { SourceControlService } from './SourceControlService';

const instance = new GithubService();

export function useSourceControlService(): SourceControlService {
  return instance;
}
