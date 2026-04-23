import { Octokit } from '@octokit/rest';
import { FileEntry, RepoInfo, SourceRepo } from '../types';
import { SourceControlService } from './SourceControlService';

export class GithubService implements SourceControlService {
  private octokit: Octokit | undefined;
  private username: string | undefined;

  async init(pat: string): Promise<string> {
    this.octokit = new Octokit({ auth: pat });
    const { data: user } = await this.octokit.users.getAuthenticated();
    this.username = user.login;
    return this.username;
  }

  isInitialized(): boolean {
    return this.octokit !== undefined;
  }

  private requireInit(): Octokit {
    if (!this.octokit) {
      throw new Error('Service not initialized. Call init(pat) first.');
    }
    return this.octokit;
  }

  async listFunctionRepos(): Promise<SourceRepo[]> {
    const octokit = this.requireInit();

    const { data } = await octokit.search.repos({
      q: `topic:serverless-function user:${this.username}`,
    });

    return data.items.map((item) => ({
      owner: item.owner?.login ?? '',
      name: item.name,
      url: item.html_url,
      defaultBranch: item.default_branch,
    }));
  }

  async push(repo: RepoInfo, files: FileEntry[], message: string): Promise<void> {
    const octokit = this.requireInit();
    const { owner, repo: repoName, branch } = repo;

    const treeEntries = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: file.content,
          encoding: 'utf-8',
        });
        return {
          path: file.path,
          mode: file.mode,
          type: file.type as 'blob',
          sha: blob.sha,
        };
      }),
    );

    const { data: tree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree: treeEntries,
    });

    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message,
      tree: tree.sha,
      parents: [],
    });

    await octokit.git.createRef({
      owner,
      repo: repoName,
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  }

  async fetchFileContent(repo: SourceRepo, path: string): Promise<string> {
    const octokit = this.requireInit();

    const { data } = await octokit.repos.getContent({
      owner: repo.owner,
      repo: repo.name,
      path,
    });

    if (!('content' in data)) {
      throw new Error(`${path} is not a file`);
    }
    return atob(data.content);
  }
}
