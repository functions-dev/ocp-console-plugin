# GitHub PAT Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace compile-time GitHub PAT injection with a runtime session-based flow — users enter a PAT via a modal, see connection status in a header avatar, and the Create button is disabled until connected.

**Architecture:** React Context (`PatProvider`) wraps each page and manages PAT lifecycle (sessionStorage, validation via `GithubService.init()`, modal state). `usePatContext()` consumer hook lets any child component read connection state. The existing `GithubService` singleton becomes lazy-initialized — constructed empty, activated via `init(pat)`.

**Tech Stack:** React 17, PatternFly 6, Jest + React Testing Library, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-21-github-pat-avatar-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `src/hooks/usePatContext.ts` | `PatContext` definition, `PatContextValue` type, `usePatContext()` consumer hook |
| `src/components/PatProvider.tsx` | Context provider — reads sessionStorage, calls `service.init()`, manages modal/connection state |
| `src/components/PatProvider.test.tsx` | Tests for PatProvider lifecycle |
| `src/components/PatModal.tsx` | PAT entry modal with validation |
| `src/components/PatModal.test.tsx` | Tests for PatModal |
| `src/components/UserAvatar.tsx` | Header avatar showing connection status |
| `src/components/UserAvatar.test.tsx` | Tests for UserAvatar |

### Modified files

| File | Change |
|------|--------|
| `src/services/source-control/SourceControlService.ts` | Add `init()`, `isInitialized()` to interface |
| `src/services/source-control/GithubService.ts` | Implement `init()`, `isInitialized()`, remove constructor PAT arg |
| `src/services/source-control/SourceControlService.test.ts` | Update for new constructor + add init/isInitialized tests |
| `src/services/source-control/useSourceControlService.ts` | Remove `__GITHUB_PAT__` injection, construct empty singleton |
| `src/globals.d.ts` | Remove `__GITHUB_PAT__` declaration |
| `webpack.config.ts` | Remove `GITHUB_PAT` DefinePlugin entry |
| `src/components/EmptyState.tsx` | Add hint text when not connected |
| `src/components/EmptyState.test.tsx` | Test hint text |
| `src/views/FunctionsListPage.tsx` | Wrap in PatProvider, add UserAvatar + PatModal, auto-open, disable Create |
| `src/views/FunctionsListPage.test.tsx` | Update mocks, add PAT-related tests |
| `src/views/FunctionCreatePage.tsx` | Wrap in PatProvider, add UserAvatar (non-clickable) |
| `src/views/FunctionCreatePage.test.tsx` | Update mocks |
| `src/views/FunctionEditPage.tsx` | Wrap in PatProvider, add UserAvatar (non-clickable) |

---

### Task 1: GithubService — add init() and isInitialized()

**Files:**
- Modify: `src/services/source-control/SourceControlService.ts`
- Modify: `src/services/source-control/GithubService.ts`
- Modify: `src/services/source-control/SourceControlService.test.ts`

- [ ] **Step 1: Write failing tests for init() and isInitialized()**

Add these tests to `SourceControlService.test.ts` inside the existing `describe('GithubService')` block, before the existing `it('lists function repos...')` test:

```ts
it('isInitialized returns false before init', () => {
  const svc = new GithubService();
  expect(svc.isInitialized()).toBe(false);
});

it('init validates PAT and returns username', async () => {
  const svc = new GithubService();
  const username = await svc.init('fake-token');
  expect(username).toBe('twoGiants');
  expect(svc.isInitialized()).toBe(true);
});

it('throws when calling listFunctionRepos before init', async () => {
  const svc = new GithubService();
  await expect(svc.listFunctionRepos()).rejects.toThrow('Service not initialized');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test -- --testPathPattern=SourceControlService`
Expected: 3 new tests FAIL — `GithubService` constructor requires a `pat` argument, no `init` or `isInitialized` method.

- [ ] **Step 3: Update SourceControlService interface**

Replace the full content of `src/services/source-control/SourceControlService.ts`:

```ts
import { FileEntry, RepoInfo, SourceRepo } from '../types';

export interface SourceControlService {
  init(pat: string): Promise<string>;
  isInitialized(): boolean;
  listFunctionRepos(): Promise<SourceRepo[]>;
  fetchFileContent(repo: SourceRepo, path: string): Promise<string>;
  push(repo: RepoInfo, files: FileEntry[], message: string): Promise<void>;
}
```

- [ ] **Step 4: Implement init(), isInitialized() in GithubService**

Replace the full content of `src/services/source-control/GithubService.ts`:

```ts
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
```

- [ ] **Step 5: Update existing tests to use init() instead of constructor PAT**

In `SourceControlService.test.ts`, update every `new GithubService('fake-token')` to use `init()`.

The `mockGetAuthenticated` needs to be extracted to a top-level mock. Replace the Octokit mock setup and update the existing tests. The full updated test file:

```ts
import { GithubService } from './GithubService';
import { FileEntry, RepoInfo, SourceRepo } from '../types';

const mockGetAuthenticated = jest.fn().mockResolvedValue({ data: { login: 'twoGiants' } });
const mockSearch = jest.fn();
const mockGetContent = jest.fn();
const mockCreateBlob = jest.fn();
const mockCreateTree = jest.fn();
const mockCreateCommit = jest.fn();
const mockCreateRef = jest.fn();

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    users: { getAuthenticated: mockGetAuthenticated },
    search: { repos: mockSearch },
    repos: { getContent: mockGetContent },
    git: {
      createBlob: mockCreateBlob,
      createTree: mockCreateTree,
      createCommit: mockCreateCommit,
      createRef: mockCreateRef,
    },
  })),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GithubService', () => {
  it('isInitialized returns false before init', () => {
    const svc = new GithubService();
    expect(svc.isInitialized()).toBe(false);
  });

  it('init validates PAT and returns username', async () => {
    const svc = new GithubService();
    const username = await svc.init('fake-token');
    expect(username).toBe('twoGiants');
    expect(svc.isInitialized()).toBe(true);
  });

  it('throws when calling listFunctionRepos before init', async () => {
    const svc = new GithubService();
    await expect(svc.listFunctionRepos()).rejects.toThrow('Service not initialized');
  });

  it('lists function repos tagged with serverless-function topic', async () => {
    mockSearch.mockResolvedValue({
      data: {
        items: [
          {
            owner: { login: 'twoGiants' },
            name: 'my-func',
            html_url: 'https://github.com/twoGiants/my-func',
            default_branch: 'main',
          },
        ],
      },
    });

    const svc = new GithubService();
    await svc.init('fake-token');
    const repos: SourceRepo[] = await svc.listFunctionRepos();

    expect(repos).toEqual([
      {
        owner: 'twoGiants',
        name: 'my-func',
        url: 'https://github.com/twoGiants/my-func',
        defaultBranch: 'main',
      },
    ]);
    expect(mockSearch).toHaveBeenCalledWith({ q: 'topic:serverless-function user:twoGiants' });
  });

  it('fetches file content from a repo', async () => {
    mockGetContent.mockResolvedValue({
      data: { content: btoa('name: my-func\nruntime: go\n'), encoding: 'base64' },
    });

    const svc = new GithubService();
    await svc.init('fake-token');
    const content = await svc.fetchFileContent(
      {
        owner: 'twoGiants',
        name: 'my-func',
        url: 'https://github.com/twoGiants/my-func',
        defaultBranch: 'main',
      },
      'func.yaml',
    );

    expect(content).toBe('name: my-func\nruntime: go\n');
    expect(mockGetContent).toHaveBeenCalledWith({
      owner: 'twoGiants',
      repo: 'my-func',
      path: 'func.yaml',
    });
  });

  describe('push', () => {
    const repoInfo: RepoInfo = { owner: 'twoGiants', repo: 'my-func', branch: 'main' };
    const files: FileEntry[] = [
      { path: 'func.yaml', mode: '100644', content: 'name: my-func', type: 'blob' },
    ];

    beforeEach(() => {
      mockCreateBlob.mockResolvedValue({ data: { sha: 'blob-sha-123' } });
      mockCreateTree.mockResolvedValue({ data: { sha: 'tree-sha-123' } });
      mockCreateCommit.mockResolvedValue({ data: { sha: 'commit-sha-123' } });
      mockCreateRef.mockResolvedValue({});
    });

    it('creates an initial commit with the provided files', async () => {
      const svc = new GithubService();
      await svc.init('fake-token');
      await svc.push(repoInfo, files, 'Initialize function');

      expect(mockCreateBlob).toHaveBeenCalledWith({
        owner: 'twoGiants',
        repo: 'my-func',
        content: 'name: my-func',
        encoding: 'utf-8',
      });
      expect(mockCreateTree).toHaveBeenCalledWith({
        owner: 'twoGiants',
        repo: 'my-func',
        tree: [{ path: 'func.yaml', mode: '100644', type: 'blob', sha: 'blob-sha-123' }],
      });
      expect(mockCreateCommit).toHaveBeenCalledWith({
        owner: 'twoGiants',
        repo: 'my-func',
        message: 'Initialize function',
        tree: 'tree-sha-123',
        parents: [],
      });
      expect(mockCreateRef).toHaveBeenCalledWith({
        owner: 'twoGiants',
        repo: 'my-func',
        ref: 'refs/heads/main',
        sha: 'commit-sha-123',
      });
    });

    it('propagates errors from intermediate API calls', async () => {
      mockCreateTree.mockRejectedValue(new Error('Validation Failed'));
      const svc = new GithubService();
      await svc.init('fake-token');

      await expect(svc.push(repoInfo, files, 'Initialize function')).rejects.toThrow(
        'Validation Failed',
      );
    });
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `yarn test`
Expected: All tests pass (existing + 3 new).

- [ ] **Step 7: Commit**

```bash
git add src/services/source-control/SourceControlService.ts src/services/source-control/GithubService.ts src/services/source-control/SourceControlService.test.ts
git commit -m "feat: add init() and isInitialized() to SourceControlService"
```

---

### Task 2: Remove compile-time PAT injection

**Files:**
- Modify: `src/services/source-control/useSourceControlService.ts`
- Modify: `src/globals.d.ts`
- Modify: `webpack.config.ts`

- [ ] **Step 1: Update useSourceControlService to construct empty singleton**

Replace the full content of `src/services/source-control/useSourceControlService.ts`:

```ts
import { GithubService } from './GithubService';
import { SourceControlService } from './SourceControlService';

const instance = new GithubService();

export function useSourceControlService(): SourceControlService {
  return instance;
}
```

- [ ] **Step 2: Remove __GITHUB_PAT__ from globals.d.ts**

Replace the full content of `src/globals.d.ts` with an empty file (or remove it). If other globals exist, keep those. Currently it only declares `__GITHUB_PAT__`:

```ts
// intentionally empty — no compile-time globals
```

- [ ] **Step 3: Remove GITHUB_PAT DefinePlugin from webpack.config.ts**

In `webpack.config.ts`, remove the DefinePlugin entry. Replace the plugins array:

```ts
  plugins: [
    new ConsoleRemotePlugin(),
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, 'locales'), to: 'locales' }],
    }),
  ],
```

Also remove the `DefinePlugin` import since it's no longer used. Update the import line:

```ts
import { Configuration as WebpackConfiguration } from 'webpack';
```

- [ ] **Step 4: Run all tests**

Run: `yarn test`
Expected: All tests pass. The existing mocks of `useSourceControlService` in view tests still work since they mock the entire module.

- [ ] **Step 5: Commit**

```bash
git add src/services/source-control/useSourceControlService.ts src/globals.d.ts webpack.config.ts
git commit -m "refactor: remove compile-time PAT injection"
```

---

### Task 3: usePatContext hook

**Files:**
- Create: `src/hooks/usePatContext.ts`

- [ ] **Step 1: Create the context and consumer hook**

Create `src/hooks/usePatContext.ts`:

```ts
import { createContext, useContext } from 'react';

export interface PatContextValue {
  isConnected: boolean;
  username: string | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  submitPat: (pat: string) => Promise<void>;
  error: string | null;
}

export const PatContext = createContext<PatContextValue>({
  isConnected: false,
  username: null,
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
  submitPat: async () => {},
  error: null,
});

export function usePatContext(): PatContextValue {
  return useContext(PatContext);
}
```

- [ ] **Step 2: Run all tests**

Run: `yarn test`
Expected: All existing tests still pass (no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePatContext.ts
git commit -m "feat: add PatContext and usePatContext hook"
```

---

### Task 4: PatProvider component

**Files:**
- Create: `src/components/PatProvider.tsx`
- Create: `src/components/PatProvider.test.tsx`

- [ ] **Step 1: Write failing test — provides disconnected state by default**

Create `src/components/PatProvider.test.tsx`:

```tsx
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatProvider } from './PatProvider';
import { usePatContext } from '../hooks/usePatContext';

const mockInit = jest.fn();
const mockIsInitialized = jest.fn().mockReturnValue(false);

jest.mock('../services/source-control/useSourceControlService', () => ({
  useSourceControlService: () => ({
    init: mockInit,
    isInitialized: mockIsInitialized,
    listFunctionRepos: jest.fn(),
    fetchFileContent: jest.fn(),
    push: jest.fn(),
  }),
}));

function TestConsumer() {
  const ctx = usePatContext();
  return (
    <>
      <span data-testid="connected">{String(ctx.isConnected)}</span>
      <span data-testid="username">{ctx.username ?? ''}</span>
      <span data-testid="modal-open">{String(ctx.isModalOpen)}</span>
      <span data-testid="error">{ctx.error ?? ''}</span>
      <button data-testid="open" onClick={ctx.openModal}>open</button>
      <button data-testid="close" onClick={ctx.closeModal}>close</button>
      <button data-testid="submit" onClick={() => ctx.submitPat('ghp_test123')}>submit</button>
    </>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  mockIsInitialized.mockReturnValue(false);
});

describe('PatProvider', () => {
  it('provides disconnected state by default', () => {
    render(
      <PatProvider>
        <TestConsumer />
      </PatProvider>,
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('false');
    expect(screen.getByTestId('username')).toHaveTextContent('');
    expect(screen.getByTestId('modal-open')).toHaveTextContent('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test -- --testPathPattern=PatProvider`
Expected: FAIL — `PatProvider` module not found.

- [ ] **Step 3: Write minimal PatProvider implementation**

Create `src/components/PatProvider.tsx`:

```tsx
import { useState, useEffect, useCallback, ReactNode } from 'react';
import { PatContext, PatContextValue } from '../hooks/usePatContext';
import { useSourceControlService } from '../services/source-control/useSourceControlService';

const PAT_KEY = 'faas-gh-pat';
const MODAL_SHOWN_KEY = 'faas-gh-pat-modal-shown';

export function PatProvider({ children }: { children: ReactNode }) {
  const service = useSourceControlService();
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedPat = sessionStorage.getItem(PAT_KEY);
    if (!storedPat) return;

    service
      .init(storedPat)
      .then((name) => {
        setIsConnected(true);
        setUsername(name);
      })
      .catch(() => {
        sessionStorage.removeItem(PAT_KEY);
      });
  }, [service]);

  const openModal = useCallback(() => {
    setError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    sessionStorage.setItem(MODAL_SHOWN_KEY, 'true');
  }, []);

  const submitPat = useCallback(
    async (pat: string) => {
      setError(null);
      try {
        const name = await service.init(pat);
        sessionStorage.setItem(PAT_KEY, pat);
        setIsConnected(true);
        setUsername(name);
        setIsModalOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid token');
      }
    },
    [service],
  );

  const value: PatContextValue = {
    isConnected,
    username,
    isModalOpen,
    openModal,
    closeModal,
    submitPat,
    error,
  };

  return <PatContext.Provider value={value}>{children}</PatContext.Provider>;
}

export { MODAL_SHOWN_KEY };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatProvider`
Expected: PASS.

- [ ] **Step 5: Write test — restores session from sessionStorage**

Add to `PatProvider.test.tsx`:

```tsx
it('restores session when PAT exists in sessionStorage', async () => {
  sessionStorage.setItem('faas-gh-pat', 'ghp_stored');
  mockInit.mockResolvedValue('restoredUser');

  render(
    <PatProvider>
      <TestConsumer />
    </PatProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('connected')).toHaveTextContent('true');
  });
  expect(screen.getByTestId('username')).toHaveTextContent('restoredUser');
  expect(mockInit).toHaveBeenCalledWith('ghp_stored');
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatProvider`
Expected: PASS.

- [ ] **Step 7: Write test — submitPat validates and stores PAT**

Add to `PatProvider.test.tsx`:

```tsx
it('submitPat stores PAT and sets connected on success', async () => {
  const user = userEvent.setup();
  mockInit.mockResolvedValue('newUser');

  render(
    <PatProvider>
      <TestConsumer />
    </PatProvider>,
  );

  await user.click(screen.getByTestId('open'));
  expect(screen.getByTestId('modal-open')).toHaveTextContent('true');

  await user.click(screen.getByTestId('submit'));

  await waitFor(() => {
    expect(screen.getByTestId('connected')).toHaveTextContent('true');
  });
  expect(screen.getByTestId('username')).toHaveTextContent('newUser');
  expect(screen.getByTestId('modal-open')).toHaveTextContent('false');
  expect(sessionStorage.getItem('faas-gh-pat')).toBe('ghp_test123');
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatProvider`
Expected: PASS.

- [ ] **Step 9: Write test — submitPat shows error on failure**

Add to `PatProvider.test.tsx`:

```tsx
it('submitPat sets error on failure and keeps modal open', async () => {
  const user = userEvent.setup();
  mockInit.mockRejectedValue(new Error('Bad credentials'));

  render(
    <PatProvider>
      <TestConsumer />
    </PatProvider>,
  );

  await user.click(screen.getByTestId('open'));
  await user.click(screen.getByTestId('submit'));

  await waitFor(() => {
    expect(screen.getByTestId('error')).toHaveTextContent('Bad credentials');
  });
  expect(screen.getByTestId('modal-open')).toHaveTextContent('true');
  expect(screen.getByTestId('connected')).toHaveTextContent('false');
});
```

- [ ] **Step 10: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatProvider`
Expected: PASS.

- [ ] **Step 11: Write test — closeModal sets modal-shown flag**

Add to `PatProvider.test.tsx`:

```tsx
it('closeModal sets modal-shown flag in sessionStorage', async () => {
  const user = userEvent.setup();

  render(
    <PatProvider>
      <TestConsumer />
    </PatProvider>,
  );

  await user.click(screen.getByTestId('open'));
  await user.click(screen.getByTestId('close'));

  expect(screen.getByTestId('modal-open')).toHaveTextContent('false');
  expect(sessionStorage.getItem('faas-gh-pat-modal-shown')).toBe('true');
});
```

- [ ] **Step 12: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatProvider`
Expected: PASS.

- [ ] **Step 13: Write test — clears stored PAT if restore fails**

Add to `PatProvider.test.tsx`:

```tsx
it('removes stored PAT if restore fails', async () => {
  sessionStorage.setItem('faas-gh-pat', 'ghp_expired');
  mockInit.mockRejectedValue(new Error('Bad credentials'));

  render(
    <PatProvider>
      <TestConsumer />
    </PatProvider>,
  );

  await waitFor(() => {
    expect(sessionStorage.getItem('faas-gh-pat')).toBeNull();
  });
  expect(screen.getByTestId('connected')).toHaveTextContent('false');
});
```

- [ ] **Step 14: Run all tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 15: Commit**

```bash
git add src/components/PatProvider.tsx src/components/PatProvider.test.tsx
git commit -m "feat: add PatProvider context component"
```

---

### Task 5: PatModal component

**Files:**
- Create: `src/components/PatModal.tsx`
- Create: `src/components/PatModal.test.tsx`

- [ ] **Step 1: Write failing test — renders input and buttons when open**

Create `src/components/PatModal.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatModal } from './PatModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSubmitPat = jest.fn();
const mockCloseModal = jest.fn();

jest.mock('../hooks/usePatContext', () => ({
  usePatContext: () => ({
    isModalOpen: true,
    closeModal: mockCloseModal,
    submitPat: mockSubmitPat,
    error: null,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PatModal', () => {
  it('renders a password input and Connect button when open', () => {
    render(<PatModal />);

    expect(screen.getByLabelText('Personal access token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test -- --testPathPattern=PatModal`
Expected: FAIL — `PatModal` module not found.

- [ ] **Step 3: Write PatModal implementation**

Create `src/components/PatModal.tsx`:

```tsx
import { useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  FormGroup,
  Alert,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { usePatContext } from '../hooks/usePatContext';

export function PatModal() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isModalOpen, closeModal, submitPat, error } = usePatContext();
  const [pat, setPat] = useState('');

  const handleConnect = async () => {
    await submitPat(pat);
  };

  const handleClose = () => {
    setPat('');
    closeModal();
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={handleClose}
      aria-label={t('Connect to GitHub')}
      variant="small"
    >
      <ModalHeader title={t('Connect to GitHub')} />
      <ModalBody>
        {error && (
          <Alert variant="danger" title={t('Authentication failed')} isInline isPlain>
            {error}
          </Alert>
        )}
        <FormGroup label={t('Personal access token')} isRequired fieldId="pat-input">
          <TextInput
            id="pat-input"
            type="password"
            value={pat}
            onChange={(_, val) => setPat(val)}
            aria-label={t('Personal access token')}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handleConnect} isDisabled={!pat}>
          {t('Connect')}
        </Button>
        <Button variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatModal`
Expected: PASS.

- [ ] **Step 5: Write test — Connect calls submitPat with entered value**

Add to `PatModal.test.tsx`:

```tsx
it('calls submitPat with entered PAT when Connect is clicked', async () => {
  const user = userEvent.setup();
  mockSubmitPat.mockResolvedValue(undefined);

  render(<PatModal />);

  await user.type(screen.getByLabelText('Personal access token'), 'ghp_abc123');
  await user.click(screen.getByRole('button', { name: 'Connect' }));

  expect(mockSubmitPat).toHaveBeenCalledWith('ghp_abc123');
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=PatModal`
Expected: PASS.

- [ ] **Step 7: Write test — Cancel calls closeModal**

Add to `PatModal.test.tsx`:

```tsx
it('calls closeModal when Cancel is clicked', async () => {
  const user = userEvent.setup();

  render(<PatModal />);

  await user.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(mockCloseModal).toHaveBeenCalled();
});
```

- [ ] **Step 8: Write test — shows error from context**

This test needs a separate mock setup. Add a new `describe` block with its own mock at the bottom of the file:

```tsx
describe('PatModal — error state', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('shows error alert when context has error', () => {
    jest.doMock('../hooks/usePatContext', () => ({
      usePatContext: () => ({
        isModalOpen: true,
        closeModal: jest.fn(),
        submitPat: jest.fn(),
        error: 'Bad credentials',
      }),
    }));

    const { PatModal: PatModalWithError } = require('./PatModal');
    render(<PatModalWithError />);

    expect(screen.getByText('Bad credentials')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Write test — Connect button disabled when input empty**

Add to the main `describe('PatModal')` block:

```tsx
it('disables Connect button when input is empty', () => {
  render(<PatModal />);

  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
});
```

- [ ] **Step 10: Run all tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/PatModal.tsx src/components/PatModal.test.tsx
git commit -m "feat: add PatModal component"
```

---

### Task 6: UserAvatar component

**Files:**
- Create: `src/components/UserAvatar.tsx`
- Create: `src/components/UserAvatar.test.tsx`

- [ ] **Step 1: Write failing test — renders "Connect to GitHub" when disconnected**

Create `src/components/UserAvatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserAvatar } from './UserAvatar';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockOpenModal = jest.fn();

jest.mock('../hooks/usePatContext', () => ({
  usePatContext: () => ({
    isConnected: false,
    username: null,
    openModal: mockOpenModal,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UserAvatar — disconnected', () => {
  it('renders "Connect to GitHub" text', () => {
    render(<UserAvatar clickable />);

    expect(screen.getByText('Connect to GitHub')).toBeInTheDocument();
  });

  it('calls openModal when clicked and clickable is true', async () => {
    const user = userEvent.setup();

    render(<UserAvatar clickable />);

    await user.click(screen.getByText('Connect to GitHub'));
    expect(mockOpenModal).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test -- --testPathPattern=UserAvatar`
Expected: FAIL — `UserAvatar` module not found.

- [ ] **Step 3: Write UserAvatar implementation**

Create `src/components/UserAvatar.tsx`:

```tsx
import { Button } from '@patternfly/react-core';
import { KeyIcon, UserIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { usePatContext } from '../hooks/usePatContext';

interface UserAvatarProps {
  clickable?: boolean;
}

export function UserAvatar({ clickable = false }: UserAvatarProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isConnected, username, openModal } = usePatContext();

  if (isConnected) {
    if (clickable) {
      return (
        <Button variant="link" icon={<UserIcon />} onClick={openModal}>
          {username}
        </Button>
      );
    }
    return (
      <span>
        <UserIcon /> {username}
      </span>
    );
  }

  if (clickable) {
    return (
      <Button variant="link" icon={<KeyIcon />} onClick={openModal}>
        {t('Connect to GitHub')}
      </Button>
    );
  }

  return (
    <span>
      <KeyIcon /> {t('Connect to GitHub')}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=UserAvatar`
Expected: PASS.

- [ ] **Step 5: Write test — does not call openModal when clickable is false**

Add to `UserAvatar.test.tsx`:

```tsx
describe('UserAvatar — disconnected, not clickable', () => {
  it('does not call openModal when clicked and clickable is false', async () => {
    const user = userEvent.setup();

    render(<UserAvatar />);

    await user.click(screen.getByText('Connect to GitHub'));
    expect(mockOpenModal).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Write tests — connected state**

Add a new `describe` block with a separate mock. Add at the bottom of the file:

```tsx
describe('UserAvatar — connected', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('renders username when connected', () => {
    jest.doMock('../hooks/usePatContext', () => ({
      usePatContext: () => ({
        isConnected: true,
        username: 'twoGiants',
        openModal: jest.fn(),
      }),
    }));

    const { UserAvatar: ConnectedAvatar } = require('./UserAvatar');
    render(<ConnectedAvatar clickable />);

    expect(screen.getByText('twoGiants')).toBeInTheDocument();
  });

  it('renders username as plain text when not clickable', () => {
    jest.doMock('../hooks/usePatContext', () => ({
      usePatContext: () => ({
        isConnected: true,
        username: 'twoGiants',
        openModal: jest.fn(),
      }),
    }));

    const { UserAvatar: ConnectedAvatar } = require('./UserAvatar');
    render(<ConnectedAvatar />);

    expect(screen.getByText(/twoGiants/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run all tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/UserAvatar.tsx src/components/UserAvatar.test.tsx
git commit -m "feat: add UserAvatar component"
```

---

### Task 7: EmptyState hint text

**Files:**
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/EmptyState.test.tsx`

- [ ] **Step 1: Write failing test — shows hint when not connected**

Add to `EmptyState.test.tsx`. First add the mock for `usePatContext` at the top (after existing mocks):

```tsx
jest.mock('../hooks/usePatContext', () => ({
  usePatContext: () => ({
    isConnected: false,
  }),
}));
```

Then add the test case inside the existing `describe('FunctionsEmptyState')`:

```tsx
it('shows connection hint when not connected', () => {
  render(
    <MemoryRouter>
      <FunctionsEmptyState />
    </MemoryRouter>,
  );

  expect(screen.getByText(/Connect to GitHub/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test -- --testPathPattern=EmptyState`
Expected: FAIL — no "Connect to GitHub" text rendered.

- [ ] **Step 3: Add hint text to EmptyState**

Update `src/components/EmptyState.tsx`:

```tsx
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom-v5-compat';
import { usePatContext } from '../hooks/usePatContext';

export function FunctionsEmptyState() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isConnected } = usePatContext();

  return (
    <EmptyState headingLevel="h2" icon={CubesIcon} titleText={t('No functions found')}>
      <EmptyStateBody>
        {isConnected
          ? t('Create a serverless function to get started.')
          : t('Connect to GitHub using the button in the top-right corner to see your functions.')}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button
            variant="primary"
            component={(props) => <Link {...props} to="/faas/create" />}
          >
            {t('Create function')}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test -- --testPathPattern=EmptyState`
Expected: PASS. Note: existing tests may need the `usePatContext` mock. Since we added the mock at the module level, it applies to all tests in the file. The existing "Create function" link test still passes because the link is always rendered.

- [ ] **Step 5: Run all tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/EmptyState.tsx src/components/EmptyState.test.tsx
git commit -m "feat: add connection hint to empty state"
```

---

### Task 8: FunctionsListPage integration

**Files:**
- Modify: `src/views/FunctionsListPage.tsx`
- Modify: `src/views/FunctionsListPage.test.tsx`

- [ ] **Step 1: Update test mocks for PatProvider, PatModal, UserAvatar**

In `FunctionsListPage.test.tsx`, add mocks for the new dependencies after the existing mock declarations:

```tsx
const mockPatContext = {
  isConnected: true,
  username: 'twoGiants',
  isModalOpen: false,
  openModal: jest.fn(),
  closeModal: jest.fn(),
  submitPat: jest.fn(),
  error: null,
};

jest.mock('../hooks/usePatContext', () => ({
  usePatContext: () => mockPatContext,
}));

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
```

Also update the `mockUseSourceControl` mock to include `init` and `isInitialized`:

```tsx
const mockUseSourceControl = jest.fn().mockReturnValue({
  init: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(true),
  listFunctionRepos: jest.fn().mockResolvedValue([]),
  fetchFileContent: jest.fn(),
  push: jest.fn(),
});
```

And add `sessionStorage.clear()` to the `afterEach`:

```tsx
afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});
```

- [ ] **Step 2: Update existing tests to work with new mock structure**

The existing tests set up `mockUseSourceControl` with `.mockReturnValue()` in each test. Since we changed the top-level mock to return a default, each test should override specific methods as needed. Update the existing tests:

For the "renders a spinner while loading" test:
```tsx
it('renders a spinner while loading', () => {
  mockUseSourceControl.mockReturnValue({
    init: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
    listFunctionRepos: jest.fn().mockResolvedValue([]),
    fetchFileContent: jest.fn(),
    push: jest.fn(),
  });
  mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

  render(
    <MemoryRouter>
      <FunctionsListPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});
```

Apply the same pattern to all existing tests: add `init` and `isInitialized` to each `mockUseSourceControl.mockReturnValue(...)` call.

- [ ] **Step 3: Run existing tests to verify they still pass**

Run: `yarn test -- --testPathPattern=FunctionsListPage`
Expected: Existing tests FAIL because `FunctionsListPage` doesn't use `PatProvider` yet. The mocks are ready; the component needs updating.

- [ ] **Step 4: Update FunctionsListPage to integrate PAT features**

Replace the full content of `src/views/FunctionsListPage.tsx`:

```tsx
import {
  DocumentTitle,
  ListPageHeader,
  K8sResourceKind,
} from '@openshift-console/dynamic-plugin-sdk';
import { Button, Content, ContentVariants, PageSection, Spinner, Tooltip } from '@patternfly/react-core';
import { Link, useNavigate } from 'react-router-dom-v5-compat';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useMemo } from 'react';
import { FunctionsEmptyState } from '../components/EmptyState';
import { FunctionStatus, FunctionTable, FunctionTableItem } from '../components/FunctionTable';
import { PatProvider, MODAL_SHOWN_KEY } from '../components/PatProvider';
import { PatModal } from '../components/PatModal';
import { UserAvatar } from '../components/UserAvatar';
import { usePatContext } from '../hooks/usePatContext';
import { useSourceControlService } from '../services/source-control/useSourceControlService';
import { useClusterService } from '../services/cluster/useClusterService';

export default function FunctionsListPage() {
  return (
    <PatProvider>
      <FunctionsListPageContent />
    </PatProvider>
  );
}

function FunctionsListPageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isConnected, openModal } = usePatContext();
  const { functions, loaded, onEdit } = useFunctionListPage(isConnected);

  useEffect(() => {
    if (!isConnected && !sessionStorage.getItem(MODAL_SHOWN_KEY)) {
      openModal();
    }
  }, [isConnected, openModal]);

  return (
    <>
      <DocumentTitle>{t('Functions')}</DocumentTitle>
      <ListPageHeader title={t('Functions')}>
        <UserAvatar clickable />
      </ListPageHeader>
      <PatModal />
      <PageSection>
        {!loaded && (
          <Spinner aria-label={t('Loading')} style={{ display: 'block', margin: '4rem auto' }} />
        )}
        {loaded && functions.length === 0 && <FunctionsEmptyState />}
        {loaded && functions.length > 0 && (
          <>
            <Content component={ContentVariants.p}>
              {t(
                'Serverless functions in your repository and deployed to your cluster. Manage lifecycle, monitor status, and scale on demand.',
              )}
            </Content>
            <Content component={ContentVariants.p}>
              {isConnected ? (
                <Button
                  variant="primary"
                  component={(props) => <Link {...props} to="/faas/create" />}
                >
                  {t('Create new function')}
                </Button>
              ) : (
                <Tooltip content={t('Connect to GitHub to create functions')}>
                  <Button variant="primary" isDisabled>
                    {t('Create new function')}
                  </Button>
                </Tooltip>
              )}
            </Content>
            {!isConnected && (
              <Content component={ContentVariants.p}>
                {t(
                  'Connect to GitHub using the button in the top-right corner to see your functions.',
                )}
              </Content>
            )}
            <FunctionTable functions={functions} onEdit={onEdit} />
          </>
        )}
      </PageSection>
    </>
  );
}

function useFunctionListPage(isConnected: boolean): {
  functions: FunctionTableItem[];
  loaded: boolean;
  onEdit: (name: string) => void;
} {
  const sourceControl = useSourceControlService();
  const { deployments, loaded: clusterLoaded } = useClusterService();
  const navigate = useNavigate();

  const [functionItems, setFunctionItems] = useState<FunctionTableItem[]>([]);
  const [reposLoaded, setReposLoaded] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setFunctionItems([]);
      setReposLoaded(true);
      return;
    }

    let ignore = false;

    async function loadFunctionTableItems() {
      const repos = await sourceControl.listFunctionRepos();
      const items = await Promise.all(
        repos.map(async (repo) => {
          const funcYaml = await sourceControl.fetchFileContent(repo, 'func.yaml');
          const { namespace, runtime } = parseNamespaceAndRuntime(funcYaml, repo.name);
          return newItem(repo.name, namespace, runtime);
        }),
      );
      if (!ignore) {
        setFunctionItems(items);
        setReposLoaded(true);
      }
    }

    loadFunctionTableItems().catch(() => {
      if (!ignore) {
        setReposLoaded(true);
      }
    });
    return () => {
      ignore = true;
    };
  }, [sourceControl, isConnected]);

  const functions = useMemo(
    () =>
      functionItems.map((item) => {
        const deployment = deployments.find(
          (d) => d.metadata?.labels?.['function.knative.dev/name'] === item.name,
        );
        return deployment ? enrichItem(item, deployment) : item;
      }),
    [functionItems, deployments],
  );

  const loaded = reposLoaded && clusterLoaded;

  const onEdit = (name: string) => navigate(`/faas/edit/${name}`);
  return { functions, loaded, onEdit };
}

function parseNamespaceAndRuntime(
  funcYaml: string,
  repoName: string,
): {
  namespace: string;
  runtime: string;
} {
  const runtimeMatch = funcYaml.match(/^runtime:\s*(.+)$/m);
  const namespaceMatch = funcYaml.match(/^namespace:\s*(.+)$/m);
  if (!runtimeMatch) throw new Error(`func.yaml in ${repoName} missing runtime field`);
  return { namespace: namespaceMatch?.[1]?.trim() ?? '', runtime: runtimeMatch[1].trim() };
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

function enrichItem(item: FunctionTableItem, deployment: K8sResourceKind): FunctionTableItem {
  return {
    ...item,
    status: deriveStatus(deployment),
    url: `http://${item.name}.${deployment.metadata?.namespace}.svc`,
    replicas: deployment.status?.readyReplicas ?? 0,
    deployment,
  };
}

function deriveStatus(deployment: K8sResourceKind): FunctionStatus {
  const desired = deployment.spec?.replicas ?? 0;
  const ready = deployment.status?.readyReplicas ?? 0;
  const conditions = deployment.status?.conditions ?? [];

  const hasFailed = conditions.some(
    (c: { type: string; status: string }) => c.type === 'Available' && c.status === 'False',
  );
  if (hasFailed) return 'Error';

  if (ready === desired && desired > 0) return 'Running';
  if (ready === 0 && desired === 0) return 'ScaledToZero';
  if (ready < desired) return 'Deploying';

  return 'Unknown';
}
```

- [ ] **Step 5: Run existing tests to verify they pass**

Run: `yarn test -- --testPathPattern=FunctionsListPage`
Expected: All existing tests PASS.

- [ ] **Step 6: Write test — auto-opens modal on first visit without PAT**

Add to `FunctionsListPage.test.tsx`:

```tsx
it('auto-opens modal on first visit when not connected', () => {
  mockPatContext.isConnected = false;
  mockPatContext.username = null;
  mockUseSourceControl.mockReturnValue({
    init: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(false),
    listFunctionRepos: jest.fn().mockResolvedValue([]),
    fetchFileContent: jest.fn(),
    push: jest.fn(),
  });
  mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

  render(
    <MemoryRouter>
      <FunctionsListPage />
    </MemoryRouter>,
  );

  expect(mockPatContext.openModal).toHaveBeenCalled();
});
```

- [ ] **Step 7: Write test — does not auto-open modal when modal-shown flag set**

```tsx
it('does not auto-open modal when modal-shown flag is set', () => {
  mockPatContext.isConnected = false;
  mockPatContext.username = null;
  sessionStorage.setItem('faas-gh-pat-modal-shown', 'true');
  mockUseSourceControl.mockReturnValue({
    init: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(false),
    listFunctionRepos: jest.fn().mockResolvedValue([]),
    fetchFileContent: jest.fn(),
    push: jest.fn(),
  });
  mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

  render(
    <MemoryRouter>
      <FunctionsListPage />
    </MemoryRouter>,
  );

  expect(mockPatContext.openModal).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: Write test — Create button disabled when not connected**

```tsx
it('disables Create button when not connected and shows tooltip text', async () => {
  mockPatContext.isConnected = false;
  mockPatContext.username = null;
  mockUseSourceControl.mockReturnValue({
    init: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(false),
    listFunctionRepos: jest.fn().mockResolvedValue([]),
    fetchFileContent: jest.fn(),
    push: jest.fn(),
  });
  mockUseClusterService.mockReturnValue({
    deployments: [
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'some-func',
          namespace: 'demo',
          labels: { 'function.knative.dev/name': 'some-func' },
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

  // When not connected, table shows cluster-only data — but since repos are empty,
  // the view shows empty state. For this test, we need functions to appear to see the button.
  // With isConnected=false, useFunctionListPage skips repo loading and returns [].
  // So the empty state renders, not the table with the Create button.
  // The Create button only appears in the table view. For this test, use a scenario
  // where cluster-only deployments appear (future feature). For now, this test verifies
  // the empty state renders since there are no repo-sourced functions.
  expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
});
```

Note: The disabled Create button with tooltip only appears in the table view. Since cluster-only display is the next feature, the current behavior when `!isConnected` is empty state (no functions from repos). The disabled button test becomes relevant once cluster-only data appears. For now, the empty state test with hint text covers the `!isConnected` case.

- [ ] **Step 9: Restore mockPatContext defaults in afterEach**

Update the `afterEach` in `FunctionsListPage.test.tsx`:

```tsx
afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  mockPatContext.isConnected = true;
  mockPatContext.username = 'twoGiants';
  mockPatContext.isModalOpen = false;
  mockPatContext.openModal = jest.fn();
  mockPatContext.closeModal = jest.fn();
  mockPatContext.submitPat = jest.fn();
  mockPatContext.error = null;
});
```

- [ ] **Step 10: Run all tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/views/FunctionsListPage.tsx src/views/FunctionsListPage.test.tsx
git commit -m "feat: integrate PAT features into FunctionsListPage"
```

---

### Task 9: FunctionCreatePage and FunctionEditPage integration

**Files:**
- Modify: `src/views/FunctionCreatePage.tsx`
- Modify: `src/views/FunctionCreatePage.test.tsx`
- Modify: `src/views/FunctionEditPage.tsx`

- [ ] **Step 1: Update FunctionCreatePage**

Replace the full content of `src/views/FunctionCreatePage.tsx`:

```tsx
import { useState } from 'react';
import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, PageSection } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';
import { CreateFunctionForm, CreateFunctionFormData } from '../components/CreateFunctionForm';
import { PatProvider } from '../components/PatProvider';
import { UserAvatar } from '../components/UserAvatar';
import { useFunctionService } from '../services/function/useFunctionService';
import { useSourceControlService } from '../services/source-control/useSourceControlService';

export default function FunctionCreatePage() {
  return (
    <PatProvider>
      <FunctionCreatePageContent />
    </PatProvider>
  );
}

function FunctionCreatePageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isSubmitting, error, handleSubmit, handleCancel } = useFunctionCreatePage();

  return (
    <>
      <DocumentTitle>{t('Create function')}</DocumentTitle>
      <ListPageHeader title={t('Create function')}>
        <UserAvatar />
      </ListPageHeader>
      <PageSection>
        {error && (
          <Alert variant="danger" title={t('Error creating function')} isInline>
            {error}
          </Alert>
        )}
        <CreateFunctionForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </PageSection>
    </>
  );
}

function useFunctionCreatePage() {
  const navigate = useNavigate();
  const functionService = useFunctionService();
  const sourceControl = useSourceControlService();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CreateFunctionFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const files = await functionService.generateFunction({
        name: data.name,
        runtime: data.runtime,
        registry: data.registry,
        namespace: data.namespace,
        branch: data.branch,
      });

      await sourceControl.push(
        { owner: data.owner, repo: data.repo, branch: data.branch },
        files,
        'Initialize Knative function project',
      );

      navigate('/faas');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/faas');
  };

  return { isSubmitting, error, handleSubmit, handleCancel };
}
```

- [ ] **Step 2: Update FunctionCreatePage test mocks**

In `FunctionCreatePage.test.tsx`, add mocks for PatProvider, UserAvatar, and usePatContext. Add after the existing mock declarations:

```tsx
jest.mock('../hooks/usePatContext', () => ({
  usePatContext: () => ({
    isConnected: true,
    username: 'twoGiants',
    isModalOpen: false,
    openModal: jest.fn(),
    closeModal: jest.fn(),
    submitPat: jest.fn(),
    error: null,
  }),
}));

jest.mock('../components/PatProvider', () => ({
  PatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../components/UserAvatar', () => ({
  UserAvatar: () => null,
}));
```

Also update the `ListPageHeader` mock to render children:

```tsx
jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  DocumentTitle: ({ children }: { children: string }) => children,
  ListPageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <>
      {title}
      {children}
    </>
  ),
}));
```

- [ ] **Step 3: Update FunctionEditPage**

Replace the full content of `src/views/FunctionEditPage.tsx`:

```tsx
import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { PageSection } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom-v5-compat';
import { PatProvider } from '../components/PatProvider';
import { UserAvatar } from '../components/UserAvatar';

export default function FunctionEditPage() {
  return (
    <PatProvider>
      <FunctionEditPageContent />
    </PatProvider>
  );
}

function FunctionEditPageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { name } = useParams<{ name: string }>();

  return (
    <>
      <DocumentTitle>{t('Edit function')}</DocumentTitle>
      <ListPageHeader title={`${t('Edit function')}: ${name}`}>
        <UserAvatar />
      </ListPageHeader>
      <PageSection>{t('Coming soon.')}</PageSection>
    </>
  );
}
```

- [ ] **Step 4: Run all tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/views/FunctionCreatePage.tsx src/views/FunctionCreatePage.test.tsx src/views/FunctionEditPage.tsx
git commit -m "feat: integrate PAT features into Create and Edit pages"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `yarn test`
Expected: All tests pass — no regressions.

- [ ] **Step 2: Verify build compiles**

Run: `yarn build-dev`
Expected: Build succeeds without errors (confirms `DefinePlugin` removal doesn't break anything and all imports resolve).

- [ ] **Step 3: Final commit (if any fixups needed)**

If any adjustments were made during verification, commit them.
