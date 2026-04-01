import { DeployedFunction } from '../types';

export function useClusterService(): {
  functions: DeployedFunction[];
  loaded: boolean;
} {
  const functions: DeployedFunction[] = [
    {
      name: 'func-demo-26',
      namespace: 'demo',
      runtime: 'go',
      replicas: 1,
      status: 'Running',
      url: 'http://func-demo-26.demo.svc',
    },
  ];

  return { functions, loaded: true };
}
