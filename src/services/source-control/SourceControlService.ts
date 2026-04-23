import { FileEntry, RepoInfo, SourceRepo } from '../types';

export interface SourceControlService {
  init(pat: string): Promise<string>;
  isInitialized(): boolean;
  listFunctionRepos(): Promise<SourceRepo[]>;
  fetchFileContent(repo: SourceRepo, path: string): Promise<string>;
  push(repo: RepoInfo, files: FileEntry[], message: string): Promise<void>;
}
