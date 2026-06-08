import { render, screen } from '@testing-library/react';
import { useClusterService } from './useClusterService';

const mockUseK8sWatchResource = vi.fn();

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: (...args: unknown[]) => mockUseK8sWatchResource(...args),
}));

const mockKsvc = {
  apiVersion: 'serving.knative.dev/v1',
  kind: 'Service',
  metadata: {
    name: 'my-func',
    namespace: 'demo',
    labels: { 'function.knative.dev/name': 'my-func' },
  },
  status: {
    url: 'https://my-func-demo.apps.example.com',
    latestReadyRevisionName: 'my-func-00001',
    conditions: [{ type: 'Ready', status: 'True' }],
  },
};

const mockDeployment = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'my-func-00001-deployment',
    namespace: 'demo',
    labels: {
      'function.knative.dev/name': 'my-func',
      'serving.knative.dev/revision': 'my-func-00001',
    },
    ownerReferences: [
      {
        apiVersion: 'serving.knative.dev/v1',
        kind: 'Revision',
        name: 'my-func-00001',
        uid: 'rev-uid-001',
        controller: true,
        blockOwnerDeletion: true,
      },
    ],
  },
  spec: { replicas: 1 },
  status: { readyReplicas: 1 },
};

function TestConsumer({ functionNames = [] }: { functionNames?: string[] }) {
  const { functions, loaded, error } = useClusterService(functionNames);
  const entries = Object.entries(functions);
  return (
    <>
      <span data-testid="loaded">{String(loaded)}</span>
      <span data-testid="error">{String(error)}</span>
      <span data-testid="fn-count">{entries.length}</span>
      {entries.map(([name, info]) => (
        <div key={name} data-testid="fn-entry">
          <span data-testid="fn-name">{name}</span>
          <span data-testid="fn-ksvc">{info.knativeService.metadata?.name}</span>
          <span data-testid="fn-dep">{info.deployment?.metadata?.name ?? 'none'}</span>
        </div>
      ))}
    </>
  );
}

describe('useClusterService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes null config when function names are empty', () => {
    mockUseK8sWatchResource.mockReturnValue([[], true, null]);

    render(<TestConsumer />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('loaded')).toHaveTextContent('true');
    expect(screen.getByTestId('fn-count')).toHaveTextContent('0');
  });

  it('watches Knative Services with In selector for given function names', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[mockKsvc], true, null])
      .mockReturnValueOnce([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith({
      groupVersionKind: { group: 'serving.knative.dev', version: 'v1', kind: 'Service' },
      isList: true,
      selector: {
        matchExpressions: [
          { key: 'function.knative.dev/name', operator: 'In', values: ['my-func'] },
        ],
      },
    });
    expect(screen.getByTestId('fn-count')).toHaveTextContent('1');
    expect(screen.getByTestId('fn-ksvc')).toHaveTextContent('my-func');
  });

  it('watches Deployments with In selector for given function names', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[mockKsvc], true, null])
      .mockReturnValueOnce([[mockDeployment], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith({
      groupVersionKind: { group: 'apps', version: 'v1', kind: 'Deployment' },
      isList: true,
      selector: {
        matchExpressions: [
          { key: 'function.knative.dev/name', operator: 'In', values: ['my-func'] },
        ],
      },
    });
    expect(screen.getByTestId('fn-dep')).toHaveTextContent('my-func-00001-deployment');
  });

  it('returns empty record when not loaded', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], false, null])
      .mockReturnValueOnce([[], false, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('loaded')).toHaveTextContent('false');
    expect(screen.getByTestId('fn-count')).toHaveTextContent('0');
  });

  it('propagates deployment watch error', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, new Error('forbidden')]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('error')).toHaveTextContent('Error: forbidden');
  });

  it('pairs ksvc and deployment together by revision', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[mockKsvc], true, null])
      .mockReturnValueOnce([[mockDeployment], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('fn-count')).toHaveTextContent('1');
    expect(screen.getByTestId('fn-ksvc')).toHaveTextContent('my-func');
    expect(screen.getByTestId('fn-dep')).toHaveTextContent('my-func-00001-deployment');
  });

  it('returns undefined deployment when ksvc has no matching deployment', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[mockKsvc], true, null])
      .mockReturnValueOnce([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('fn-count')).toHaveTextContent('1');
    expect(screen.getByTestId('fn-dep')).toHaveTextContent('none');
  });

  it('picks deployment matching the latest ready revision', () => {
    const ksvcRev2 = {
      ...mockKsvc,
      status: {
        ...mockKsvc.status,
        latestReadyRevisionName: 'my-func-00002',
      },
    };
    const oldDep = mockDeployment;
    const newDep = {
      ...mockDeployment,
      metadata: {
        ...mockDeployment.metadata,
        name: 'my-func-00002-deployment',
        labels: {
          'function.knative.dev/name': 'my-func',
          'serving.knative.dev/revision': 'my-func-00002',
        },
      },
      status: { readyReplicas: 2 },
    };

    mockUseK8sWatchResource
      .mockReturnValueOnce([[ksvcRev2], true, null])
      .mockReturnValueOnce([[oldDep, newDep], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('fn-dep')).toHaveTextContent('my-func-00002-deployment');
  });
});
