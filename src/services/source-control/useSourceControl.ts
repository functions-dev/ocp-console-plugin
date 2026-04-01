import { RepoInfo } from '../types';

export function useSourceControl(): {
  repos: RepoInfo[];
  loaded: boolean;
} {
  const repos: RepoInfo[] = [
    {
      owner: 'twoGiants',
      name: 'issue-744-go-func-from-built-binary',
      url: 'https://github.com/twoGiants/issue-744-go-func-from-built-binary',
      defaultBranch: 'master',
    },
    {
      owner: 'twoGiants',
      name: 'issue-744-go-func',
      url: 'https://github.com/twoGiants/issue-744-go-func',
      defaultBranch: 'master',
    },
    {
      owner: 'twoGiants',
      name: 'func-demo-26',
      url: 'https://github.com/twoGiants/func-demo-26',
      defaultBranch: 'main',
    },
  ];

  return { repos, loaded: true };
}
