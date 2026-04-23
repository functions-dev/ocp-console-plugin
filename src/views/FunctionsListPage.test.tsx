import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import FunctionsListPage from './FunctionsListPage';
import { usePatContext } from '../hooks/usePatContext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  DocumentTitle: ({ children }: { children: string }) => children,
  ListPageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <>
      {title}
      {children}
    </>
  ),
}));

jest.mock('../hooks/usePatContext', () => ({
  usePatContext: jest.fn().mockReturnValue({
    isConnected: true,
    username: 'twoGiants',
    isModalOpen: false,
    openModal: jest.fn(),
    closeModal: jest.fn(),
    submitPat: jest.fn(),
    error: null,
  }),
}));

const mockOpenModal = jest.fn();

jest.mock('../components/PatProvider', () => ({
  PatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MODAL_SHOWN_KEY: 'faas-gh-pat-modal-shown',
}));

jest.mock('../components/PatModal', () => ({
  PatModal: () => null,
}));

jest.mock('../components/UserAvatar', () => ({
  UserAvatar: () => null,
}));

const mockUseSourceControl = jest.fn();
jest.mock('../services/source-control/useSourceControlService', () => ({
  useSourceControlService: () => mockUseSourceControl(),
}));

const mockUseClusterService = jest.fn();
jest.mock('../services/cluster/useClusterService', () => ({
  useClusterService: () => mockUseClusterService(),
}));

jest.mock('../components/FunctionTable', () => ({
  FunctionTable: ({ functions }: { functions: { name: string }[] }) =>
    functions.map((f) => f.name).join(','),
}));

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  // Reset usePatContext to connected state (default for most tests)
  (usePatContext as jest.Mock).mockReturnValue({
    isConnected: true,
    username: 'twoGiants',
    isModalOpen: false,
    openModal: mockOpenModal,
    closeModal: jest.fn(),
    submitPat: jest.fn(),
    error: null,
  });
  mockOpenModal.mockClear();
});

function defaultSourceControl() {
  return {
    init: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
    listFunctionRepos: jest.fn().mockResolvedValue([]),
    fetchFileContent: jest.fn(),
    push: jest.fn(),
  };
}

describe('FunctionsListPage', () => {
  it('renders a spinner while loading', () => {
    mockUseSourceControl.mockReturnValue(defaultSourceControl());
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the empty state when loaded with no functions', async () => {
    mockUseSourceControl.mockReturnValue(defaultSourceControl());
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('renders table when functions are loaded', async () => {
    mockUseSourceControl.mockReturnValue({
      ...defaultSourceControl(),
      listFunctionRepos: jest.fn().mockResolvedValue([
        {
          owner: 'twoGiants',
          name: 'my-func',
          url: 'https://github.com/twoGiants/my-func',
          defaultBranch: 'main',
        },
      ]),
      fetchFileContent: jest
        .fn()
        .mockResolvedValue('name: my-func\nruntime: go\nnamespace: demo\n'),
    });
    mockUseClusterService.mockReturnValue({
      deployments: [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'my-func',
            namespace: 'demo',
            labels: { 'function.knative.dev/name': 'my-func' },
          },
          spec: { replicas: 1 },
          status: { readyReplicas: 1 },
        },
      ],
      loaded: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('my-func')).toBeInTheDocument();
  });

  it('shows NotDeployed status for repos without cluster deployment', async () => {
    mockUseSourceControl.mockReturnValue({
      ...defaultSourceControl(),
      listFunctionRepos: jest.fn().mockResolvedValue([
        {
          owner: 'twoGiants',
          name: 'orphan-func',
          url: 'https://github.com/twoGiants/orphan-func',
          defaultBranch: 'main',
        },
      ]),
      fetchFileContent: jest
        .fn()
        .mockResolvedValue('name: orphan-func\nruntime: node\nnamespace: demo\n'),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('orphan-func')).toBeInTheDocument();
  });

  it('renders empty state when GitHub API fails', async () => {
    mockUseSourceControl.mockReturnValue({
      ...defaultSourceControl(),
      listFunctionRepos: jest.fn().mockRejectedValue(new Error('Requires authentication')),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('auto-opens modal on first visit when not connected', () => {
    (usePatContext as jest.Mock).mockReturnValue({
      isConnected: false,
      username: null,
      isModalOpen: false,
      openModal: mockOpenModal,
      closeModal: jest.fn(),
      submitPat: jest.fn(),
      error: null,
    });
    mockUseSourceControl.mockReturnValue(defaultSourceControl());
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(mockOpenModal).toHaveBeenCalled();
  });

  it('does not auto-open modal when modal-shown flag is set', () => {
    (usePatContext as jest.Mock).mockReturnValue({
      isConnected: false,
      username: null,
      isModalOpen: false,
      openModal: mockOpenModal,
      closeModal: jest.fn(),
      submitPat: jest.fn(),
      error: null,
    });
    sessionStorage.setItem('faas-gh-pat-modal-shown', 'true');
    mockUseSourceControl.mockReturnValue(defaultSourceControl());
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(mockOpenModal).not.toHaveBeenCalled();
  });
});
