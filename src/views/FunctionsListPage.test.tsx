import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import FunctionsListPage from './FunctionsListPage';

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

let mockPat = '';
const mockSetPat = jest.fn();
const mockClearPat = jest.fn();

jest.mock('../contexts/PatContext', () => ({
  PatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePatContext: () => ({
    pat: mockPat,
    user: mockPat ? { login: 'twoGiants', avatarUrl: 'https://avatar' } : null,
    setPat: mockSetPat,
    clearPat: mockClearPat,
  }),
}));

jest.mock('../components/UserAvatar', () => ({
  UserAvatar: ({ clickable }: { clickable: boolean }) => (
    <div data-testid="user-avatar" data-clickable={clickable} />
  ),
}));

jest.mock('../components/PatModal', () => ({
  PatModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="pat-modal">
        <button onClick={onClose}>dismiss</button>
      </div>
    ) : null,
}));

afterEach(() => {
  mockPat = '';
  jest.restoreAllMocks();
});

describe('FunctionsListPage', () => {
  it('renders a spinner while loading', () => {
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockResolvedValue([]),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the empty state when loaded with no functions', async () => {
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockResolvedValue([]),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('renders table when functions are loaded', async () => {
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
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
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
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
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockRejectedValue(new Error('Requires authentication')),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('renders UserAvatar in header', () => {
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockResolvedValue([]),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    const avatar = screen.getByTestId('user-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('data-clickable', 'true');
  });

  it('auto-opens PatModal when no PAT', () => {
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockResolvedValue([]),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('pat-modal')).toBeInTheDocument();
  });

  it('does not auto-open PatModal when PAT exists', () => {
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockResolvedValue([]),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('pat-modal')).not.toBeInTheDocument();
  });

  it('shows hint alert when PatModal dismissed without PAT', () => {
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: jest.fn().mockResolvedValue([]),
      fetchFileContent: jest.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    screen.getByText('dismiss').click();

    expect(
      screen.getByText("Click 'Connect to GitHub' in the top-right corner to link your account."),
    ).toBeInTheDocument();
  });

  it('disables Create button when no PAT', async () => {
    mockUseSourceControl.mockReturnValue({
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
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', { name: 'Create new function' });
    expect(button).toBeDisabled();
  });

  it('enables Create button when PAT is set', async () => {
    mockPat = 'ghp_valid';
    mockUseSourceControl.mockReturnValue({
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
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    const link = await screen.findByRole('link', { name: 'Create new function' });
    expect(link).toBeInTheDocument();
  });
});
