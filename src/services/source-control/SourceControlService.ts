import { FileEntry, ForgeUser, RepoMetadata } from '../types';

export interface SourceControlService {
  listFunctionRepos(): Promise<RepoMetadata[]>;
  fetchFileContent(repo: RepoMetadata, path: string): Promise<string>;
  createRepo(repo: RepoMetadata, files: FileEntry[], message: string): Promise<void>;
  createRepoWithSecret(
    repo: RepoMetadata,
    files: FileEntry[],
    message: string,
    secret: { name: string; value: string },
  ): Promise<void>;
  updateRepo(repo: RepoMetadata, files: FileEntry[], message: string): Promise<void>;
  fetch(repo: RepoMetadata): Promise<FileEntry[]>;
  fetchUserInfo(pat: string): Promise<ForgeUser>;
  createSecret(repo: RepoMetadata, name: string, value: string): Promise<void>;
}
