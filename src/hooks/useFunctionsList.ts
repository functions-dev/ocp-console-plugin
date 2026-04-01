import { useClusterService } from '../services/cluster/useClusterService';
import { useSourceControl } from '../services/source-control/useSourceControl';
import { DeployedFunction, FunctionListItem, RepoInfo } from '../services/types';

export function mergeFunctionData(
  repos: RepoInfo[],
  deployments: DeployedFunction[],
): FunctionListItem[] {
  return repos.map((repo) => {
    const deployment = deployments.find((d) => d.name === repo.name);
    if (deployment) {
      return {
        name: deployment.name,
        namespace: deployment.namespace,
        runtime: deployment.runtime,
        status: deployment.status,
        url: deployment.url,
        replicas: deployment.replicas,
      };
    }
    return {
      name: repo.name,
      namespace: '',
      runtime: '',
      status: 'NotDeployed' as const,
      replicas: 0,
    };
  });
}

export function useFunctionsList(): {
  functions: FunctionListItem[];
  loaded: boolean;
} {
  const { repos, loaded: reposLoaded } = useSourceControl();
  const { functions: deployments, loaded: deploymentsLoaded } =
    useClusterService();

  const functions = mergeFunctionData(repos, deployments);
  return { functions, loaded: reposLoaded && deploymentsLoaded };
}
