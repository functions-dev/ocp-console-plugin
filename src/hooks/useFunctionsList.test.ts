import { DeployedFunction, RepoInfo } from '../services/types';
import { mergeFunctionData } from './useFunctionsList';

describe('mergeFunctionData', () => {
  it('merges deployed function with repo data', () => {
    const repos: RepoInfo[] = [
      {
        owner: 'twoGiants',
        name: 'func-demo-26',
        url: 'https://github.com/twoGiants/func-demo-26',
        defaultBranch: 'main',
      },
    ];
    const deployments: DeployedFunction[] = [
      {
        name: 'func-demo-26',
        namespace: 'demo',
        runtime: 'go',
        replicas: 1,
        status: 'Running',
        url: 'http://func-demo-26.demo.svc',
      },
    ];

    const result = mergeFunctionData(repos, deployments);

    expect(result).toEqual([
      {
        name: 'func-demo-26',
        namespace: 'demo',
        runtime: 'go',
        status: 'Running',
        url: 'http://func-demo-26.demo.svc',
        replicas: 1,
      },
    ]);
  });

  it('marks functions without deployment as NotDeployed', () => {
    const repos: RepoInfo[] = [
      {
        owner: 'twoGiants',
        name: 'issue-744-go-func',
        url: 'https://github.com/twoGiants/issue-744-go-func',
        defaultBranch: 'master',
      },
    ];
    const deployments: DeployedFunction[] = [];

    const result = mergeFunctionData(repos, deployments);

    expect(result).toEqual([
      {
        name: 'issue-744-go-func',
        namespace: '',
        runtime: '',
        status: 'NotDeployed',
        replicas: 0,
      },
    ]);
  });

  it('returns one item per repo', () => {
    const repos: RepoInfo[] = [
      {
        owner: 'twoGiants',
        name: 'func-demo-26',
        url: 'https://github.com/twoGiants/func-demo-26',
        defaultBranch: 'main',
      },
      {
        owner: 'twoGiants',
        name: 'issue-744-go-func',
        url: 'https://github.com/twoGiants/issue-744-go-func',
        defaultBranch: 'master',
      },
    ];
    const deployments: DeployedFunction[] = [
      {
        name: 'func-demo-26',
        namespace: 'demo',
        runtime: 'go',
        replicas: 1,
        status: 'Running',
        url: 'http://func-demo-26.demo.svc',
      },
    ];

    const result = mergeFunctionData(repos, deployments);

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no repos exist', () => {
    const result = mergeFunctionData([], []);

    expect(result).toEqual([]);
  });
});
