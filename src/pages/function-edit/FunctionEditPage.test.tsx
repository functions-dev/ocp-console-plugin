import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../testing/msw/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom-v5-compat';
import FunctionEditPage from './FunctionEditPage';
import { TOKEN_KEY } from '../../common/services/types';

const GITHUB_API = 'https://api.github.com';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mockOnChange: ((value: string) => void) | undefined;

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  DocumentTitle: ({ children }: { children: string }) => children,
  ListPageHeader: ({ title }: { title: string }) => title,
  CodeEditor: ({ onChange }: { onChange?: (value: string) => void }) => {
    mockOnChange = onChange;
    return 'CodeEditor';
  },
}));

function renderEditPage(name: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/faas/edit/${name}` }]}>
      <Routes>
        <Route path="/faas/edit/:name" element={<FunctionEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setupSearchReposHandler() {
  server.use(
    http.get(`${GITHUB_API}/search/repositories`, () =>
      HttpResponse.json({
        total_count: 1,
        items: [
          {
            owner: { login: 'twoGiants' },
            name: 'my-func',
            html_url: '',
            default_branch: 'main',
          },
        ],
      }),
    ),
  );
}

function setupFetchHandlers() {
  setupSearchReposHandler();
  server.use(
    http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/trees/main`, () =>
      HttpResponse.json({
        sha: 'tree-sha',
        tree: [
          { path: 'func.yaml', type: 'blob', mode: '100644', sha: 'blob-1' },
          { path: 'index.js', type: 'blob', mode: '100644', sha: 'blob-2' },
        ],
      }),
    ),
    http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs/blob-1`, () =>
      HttpResponse.json({
        content: btoa('name: my-func\nruntime: node'),
        encoding: 'base64',
      }),
    ),
    http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs/blob-2`, () =>
      HttpResponse.json({
        content: btoa('module.exports = {}'),
        encoding: 'base64',
      }),
    ),
  );
}

describe('FunctionEditPage', () => {
  beforeAll(() => {
    sessionStorage.setItem(TOKEN_KEY, 'test-pat');
  });

  afterAll(() => {
    sessionStorage.clear();
  });

  it('shows loading state in tree while fetching files', () => {
    setupSearchReposHandler();
    server.use(
      http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/trees/main`, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    renderEditPage('my-func');

    expect(screen.getByText('Loading source...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & Deploy/ })).toBeDisabled();
  });

  it('loads files from GitHub', async () => {
    setupFetchHandlers();

    renderEditPage('my-func');

    await waitFor(() => {
      expect(screen.getByText('func.yaml')).toBeInTheDocument();
      expect(screen.getByText('index.js')).toBeInTheDocument();
    });
  });

  it('shows empty tree and disabled save when repo not found', async () => {
    renderEditPage('nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No files')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Save & Deploy/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Back to Functions/ })).toBeInTheDocument();
  });

  it('auto-selects handler file based on runtime from func.yaml', async () => {
    setupFetchHandlers();

    renderEditPage('my-func');

    await waitFor(() => {
      const indexItem = screen.getByText('index.js').closest('[role="treeitem"]');
      expect(indexItem).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('navigates back without modal when no changes made', async () => {
    setupFetchHandlers();

    renderEditPage('my-func');

    await waitFor(() => {
      expect(screen.getByText('func.yaml')).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByRole('button', { name: /Back to Functions/ }));

    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('shows success message after save and hides it after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupFetchHandlers();
    setupPushHandlers();

    renderEditPage('my-func');

    await waitFor(() => {
      expect(screen.getByText('func.yaml')).toBeInTheDocument();
    });

    act(() => mockOnChange?.('edited content'));

    await userEvent.setup().click(screen.getByRole('button', { name: /Save & Deploy/ }));

    await waitFor(() => {
      expect(screen.getByText('Pushed to GitHub. Deployment running...')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.queryByText('Pushed to GitHub. Deployment running...')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});

function setupPushHandlers() {
  setupSearchReposHandler();
  server.use(
    http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/ref/:ref+`, () =>
      HttpResponse.json({ object: { sha: 'head-sha' } }),
    ),
    http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/commits/head-sha`, () =>
      HttpResponse.json({ tree: { sha: 'parent-tree-sha' } }),
    ),
    http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs`, () =>
      HttpResponse.json({ sha: 'blob-sha' }),
    ),
    http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/trees`, () =>
      HttpResponse.json({ sha: 'tree-sha' }),
    ),
    http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/commits`, () =>
      HttpResponse.json({ sha: 'commit-sha' }),
    ),
    http.patch(`${GITHUB_API}/repos/twoGiants/my-func/git/refs/:ref+`, () => HttpResponse.json({})),
  );
}
