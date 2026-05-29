import {
  DocumentTitle,
  K8sResourceKind,
  ListPageHeader,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Content,
  ContentVariants,
  PageSection,
  Spinner,
} from '@patternfly/react-core';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom-v5-compat';
import { FunctionsEmptyState } from './components/EmptyState';
import { FunctionStatus, FunctionTable, FunctionTableItem } from './components/FunctionTable';
import { UserAvatar } from '../../common/components/UserAvatar';
import {
  ForgeConnectionContext,
  ForgeConnectionProvider,
} from '../../common/context/ForgeConnectionProvider';
import { useClusterService } from '../../common/services/cluster/useClusterService';
import { useSourceControlService } from '../../common/services/source-control/useSourceControlService';
import { RepoMetadata } from '../../common/services/types';
import { errorMessage, parseNamespaceAndRuntime } from '../../common/utils/utils';

export default function FunctionsListPage() {
  return (
    <ForgeConnectionProvider>
      <FunctionsListPageContent />
    </ForgeConnectionProvider>
  );
}

function FunctionsListPageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { functions, loaded, onEdit, isConnectedToForge, error } = useFunctionListPage();

  return (
    <>
      <DocumentTitle>{t('Functions')}</DocumentTitle>
      <ListPageHeader title={t('Functions')}>
        <UserAvatar enableReconnect />
      </ListPageHeader>
      <PageSection>
        {error && (
          <Alert variant="danger" title={t('Error listing functions')} isInline>
            {error}
          </Alert>
        )}
        {!loaded && (
          <Spinner aria-label={t('Loading')} style={{ display: 'block', margin: '4rem auto' }} />
        )}
        {loaded && functions.length === 0 && (
          <FunctionsEmptyState isCreateDisabled={!isConnectedToForge} />
        )}
        {loaded && functions.length > 0 && (
          <>
            <Content component={ContentVariants.p}>
              {t(
                'Serverless functions in your repository and deployed to your cluster. Manage lifecycle, monitor status, and scale on demand.',
              )}
            </Content>
            <Content component={ContentVariants.p}>
              {!isConnectedToForge ? (
                <Button variant="primary" isDisabled>
                  {t('Create new function')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  component={(props) => <Link {...props} to="/faas/create" />}
                >
                  {t('Create new function')}
                </Button>
              )}
            </Content>
            <FunctionTable functions={functions} onEdit={onEdit} />
          </>
        )}
      </PageSection>
    </>
  );
}

function useFunctionListPage(): {
  functions: FunctionTableItem[];
  loaded: boolean;
  onEdit: (name: string) => void;
  isConnectedToForge: boolean;
  error: string;
} {
  const { isActive: isConnectedToForge, connectionId } = useContext(ForgeConnectionContext);
  const sourceControl = useSourceControlService();
  const navigate = useNavigate();

  const [functionItems, setFunctionItems] = useState<FunctionTableItem[]>([]);
  const [reposLoaded, setReposLoaded] = useState(!isConnectedToForge);
  const [prevConnectionId, setPrevConnectionId] = useState(connectionId);

  const [error, setError] = useState<string>('');

  // Reset state when connection changes (initial connect or user switch)
  if (connectionId !== prevConnectionId) {
    setPrevConnectionId(connectionId);
    setFunctionItems([]);
    setError('');
    setReposLoaded(false);
  }

  useEffect(() => {
    if (!isConnectedToForge) return;

    let ignore = false;

    async function loadFunctionTableItems() {
      let repos: RepoMetadata[];
      let items: FunctionTableItem[];
      try {
        repos = await sourceControl.listFunctionRepos();
        items = await Promise.all(
          repos.map(async (repo) => {
            const funcYaml = await sourceControl.fetchFileContent(repo, 'func.yaml');
            const { namespace, runtime } = parseNamespaceAndRuntime(funcYaml);
            return newItem(repo.name, namespace, runtime);
          }),
        );
      } catch (err) {
        if (!ignore) {
          setReposLoaded(true);
          setError(errorMessage(err));
        }
        return;
      }
      if (ignore) return;

      setFunctionItems(items);
      setReposLoaded(true);
      setError('');
    }

    loadFunctionTableItems();
    return () => {
      ignore = true;
    };
  }, [sourceControl, isConnectedToForge, connectionId]);

  const functionNames = useMemo(() => functionItems.map((item) => item.name), [functionItems]);

  const { knativeServices, deployments, loaded: clusterLoaded } = useClusterService(functionNames);

  const functions = useMemo(
    () =>
      functionItems.map((item) => {
        const ksvc = knativeServices.find(
          (s) => s.metadata?.labels?.['function.knative.dev/name'] === item.name,
        );
        const latestRevision = ksvc?.status?.latestReadyRevisionName;
        const deployment = latestRevision
          ? deployments.find(
              (d) => d.metadata?.labels?.['serving.knative.dev/revision'] === latestRevision,
            )
          : deployments.find(
              (d) => d.metadata?.labels?.['function.knative.dev/name'] === item.name,
            );
        return ksvc && deployment ? enrichItem(item, ksvc, deployment) : item;
      }),
    [functionItems, knativeServices, deployments],
  );

  const loaded = reposLoaded && clusterLoaded;

  const onEdit = (name: string) => navigate(`/faas/edit/${name}`);
  return { functions, loaded, onEdit, isConnectedToForge, error };
}

function newItem(repoName: string, namespace: string, runtime: string): FunctionTableItem {
  return {
    name: repoName,
    namespace,
    runtime,
    status: 'NotDeployed' as const,
    replicas: 0,
  };
}

function enrichItem(
  item: FunctionTableItem,
  ksvc: K8sResourceKind,
  deployment: K8sResourceKind,
): FunctionTableItem {
  return {
    ...item,
    status: deriveStatus(ksvc, deployment),
    url: ksvc.status?.url,
    replicas: deployment.status?.readyReplicas ?? 0,
    deployment: ksvc,
  };
}

function deriveStatus(ksvc: K8sResourceKind, deployment: K8sResourceKind): FunctionStatus {
  const conditions = ksvc.status?.conditions ?? [];

  const ready = conditions.find((c: { type: string }) => c.type === 'Ready');
  if (!ready) return 'Deploying';

  if (ready.status === 'True') {
    const desired = deployment.spec?.replicas ?? 0;
    const readyReplicas = deployment.status?.readyReplicas ?? 0;
    if (desired === 0 && readyReplicas === 0) return 'ScaledToZero';

    return 'Running';
  }

  if (ready.status === 'False') return 'Error';

  return 'Deploying';
}
