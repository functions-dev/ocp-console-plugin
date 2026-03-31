# Function List Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a PatternFly table of serverless functions on the list page, with real API response shapes hardcoded in hook skeletons. Merging hook combines GitHub repos (source of truth) with cluster deployment status.

**Architecture:** Types → Hook skeletons (hardcoded data) → Merging hook (useFunctionsList) → Component (FunctionTable with pagination) → View (FunctionsListPage). No real API calls yet — hooks return hardcoded data captured from real K8s and GitHub responses. Future features replace hardcoded data with real API calls.

**Tech Stack:** React 17, TypeScript, PatternFly 6 (`@patternfly/react-table`, `Pagination`), OCP Dynamic Plugin SDK, Jest + React Testing Library, Cypress.

---

## Prerequisites (User-Handled)

These steps are done by the user before implementation starts:

1. **GitHub repos tagged** — `serverless-function` topic added to all three repos via `gh repo edit --add-topic`
2. **Function deployed** — `func-demo-26` deployed to namespace `demo` with raw deployer. URL: `http://func-demo-26.demo.svc`
3. **API responses captured** — saved to `.tmp/` for reference:
   - `.tmp/k8s-deployment-response.json` — `oc get deployment -n demo -l function.knative.dev/name -o json`
   - `.tmp/gh-search-response.json` — `gh api 'search/repositories?q=topic:serverless-function+user:twoGiants'`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/services/types.ts` | `DeployedFunction`, `RepoInfo`, `FunctionListItem` types |
| Create | `src/services/cluster/useClusterService.ts` | Hook returning hardcoded `DeployedFunction[]` |
| Create | `src/services/source-control/useSourceControl.ts` | Hook returning hardcoded `RepoInfo[]` |
| Create | `src/hooks/useFunctionsList.ts` | Merging hook: repos + deployments → `FunctionListItem[]` |
| Create | `src/hooks/useFunctionsList.test.ts` | Tests for merge logic |
| Create | `src/components/FunctionTable.tsx` | PatternFly table with pagination |
| Create | `src/components/FunctionTable.test.tsx` | Table component tests |
| Modify | `src/components/EmptyState.tsx` | Update i18n keys to camelCase |
| Modify | `src/components/EmptyState.test.tsx` | Update assertions for new keys |
| Modify | `src/views/FunctionsListPage.tsx` | Conditional empty state vs table |
| Modify | `src/views/FunctionsListPage.test.tsx` | Tests with hook mocks |
| Modify | `locales/en/plugin__console-functions-plugin.json` | New i18n keys (camelCase) |
| Create | `e2e/function-list-table/function-list-table.test.ts` | Cypress e2e test |

---

## Task 1: Types

**Files:**
- Create: `src/services/types.ts`

No tests — pure type definitions.

- [ ] **Step 1: Create `src/services/types.ts`**

```typescript
export interface DeployedFunction {
  name: string;
  namespace: string;
  runtime: string;
  status: 'Running' | 'ScaledToZero' | 'Deploying' | 'Error' | 'Unknown';
  url?: string;
  replicas: number;
}

export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
}

export interface FunctionListItem {
  name: string;
  namespace: string;
  runtime: string;
  status: DeployedFunction['status'] | 'NotDeployed';
  url?: string;
  replicas: number;
}
```

- [ ] **Step 2: Run `yarn test` to verify nothing breaks**

Run: `yarn test`
Expected: 4 tests pass (existing tests unaffected)

- [ ] **Step 3: Commit**

```bash
git add src/services/types.ts
git commit --author="Claude <noreply@anthropic.com>" -m "feat: add function and repo type definitions

DeployedFunction for cluster state, RepoInfo for
GitHub repos, FunctionListItem for merged table data."
```

---

## Task 2: Hook Skeletons

**Files:**
- Create: `src/services/cluster/useClusterService.ts`
- Create: `src/services/source-control/useSourceControl.ts`

No tests — hardcoded data, no logic. Tests come when real API calls are wired.

- [ ] **Step 1: Capture GitHub API response**

Run (after user has tagged repos):

```bash
gh api 'search/repositories?q=topic:serverless-function+user:twoGiants' > .tmp/gh-search-response.json
```

Extract the relevant fields per repo item for the hardcoded data.

- [ ] **Step 2: Create `src/services/cluster/useClusterService.ts`**

Hardcoded data is mapped from the captured K8s Deployment response in `.tmp/k8s-deployment-response.json`.

Mapping rules (from design doc):
- `name` ← `metadata.labels['function.knative.dev/name']`
- `namespace` ← `metadata.namespace`
- `runtime` ← `metadata.labels['function.knative.dev/runtime']`
- `replicas` ← `spec.replicas`
- `status` ← derived: `readyReplicas === spec.replicas` → `'Running'`, `readyReplicas === 0 && spec.replicas === 0` → `'ScaledToZero'`, `readyReplicas < spec.replicas` → `'Deploying'`, conditions contain failure → `'Error'`, else → `'Unknown'`
- `url` ← internal service DNS: `http://<name>.<namespace>.svc`

```typescript
import { DeployedFunction } from '../types';

// TODO(feat:cluster-service): Replace with useK8sWatchResource + useActiveNamespace.
// Real implementation watches Deployments with label function.knative.dev/name
// in the active namespace.
// Response shape captured from: oc get deployment -n demo -l function.knative.dev/name -o json
const hardcodedFunctions: DeployedFunction[] = [
  {
    name: 'func-demo-26',
    namespace: 'demo',
    runtime: 'go',
    status: 'Running',
    url: 'http://func-demo-26.demo.svc',
    replicas: 1,
  },
];

export function useClusterService(): {
  functions: DeployedFunction[];
  loaded: boolean;
} {
  return { functions: hardcodedFunctions, loaded: true };
}
```

- [ ] **Step 3: Create `src/services/source-control/useSourceControl.ts`**

Hardcoded data is mapped from the captured GitHub search response in `.tmp/gh-search-response.json`.

Mapping rules:
- `owner` ← `item.owner.login`
- `name` ← `item.name`
- `url` ← `item.html_url`
- `defaultBranch` ← `item.default_branch`

```typescript
import { RepoInfo } from '../types';

// TODO(feat:source-control): Replace with Octokit search.
// Real implementation uses search/repositories?q=topic:serverless-function+user:<owner>
// Response shape captured from: gh api 'search/repositories?q=topic:serverless-function+user:twoGiants'
const hardcodedRepos: RepoInfo[] = [
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
  {
    owner: 'twoGiants',
    name: 'issue-744-go-func-from-built-binary',
    url: 'https://github.com/twoGiants/issue-744-go-func-from-built-binary',
    defaultBranch: 'master',
  },
];

export function useSourceControl(): {
  repos: RepoInfo[];
  loaded: boolean;
} {
  return { repos: hardcodedRepos, loaded: true };
}
```

**Note:** The `defaultBranch` values above match the captured GitHub response (`func-demo-26` uses `main`, the other two use `master`).

- [ ] **Step 4: Run `yarn test` to verify nothing breaks**

Run: `yarn test`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/services/cluster/useClusterService.ts src/services/source-control/useSourceControl.ts
git commit --author="Claude <noreply@anthropic.com>" -m "feat: add hook skeletons with hardcoded data

useClusterService returns data from real K8s response.
useSourceControl returns data from real GitHub search.
Both will be replaced by real API calls in future."
```

---

## Task 3: Merging Hook — Tests

**Files:**
- Create: `src/hooks/useFunctionsList.test.ts`

The merge logic is extracted as a pure function `mergeFunctionData` so it can be tested without React hook utilities.

- [ ] **Step 1: Write tests for mergeFunctionData**

```typescript
import { mergeFunctionData } from './useFunctionsList';
import { DeployedFunction, RepoInfo } from '../services/types';

describe('mergeFunctionData', () => {
  const repos: RepoInfo[] = [
    { owner: 'twoGiants', name: 'func-demo-26', url: 'https://github.com/twoGiants/func-demo-26', defaultBranch: 'main' },
    { owner: 'twoGiants', name: 'issue-744-go-func', url: 'https://github.com/twoGiants/issue-744-go-func', defaultBranch: 'main' },
  ];

  const deployments: DeployedFunction[] = [
    {
      name: 'func-demo-26',
      namespace: 'demo',
      runtime: 'go',
      status: 'Running',
      url: 'http://func-demo-26.demo.svc',
      replicas: 1,
    },
  ];

  it('merges deployed function with repo data', () => {
    const result = mergeFunctionData(repos, deployments);

    expect(result[0]).toEqual({
      name: 'func-demo-26',
      namespace: 'demo',
      runtime: 'go',
      status: 'Running',
      url: 'http://func-demo-26.demo.svc',
      replicas: 1,
    });
  });

  it('marks functions without deployment as NotDeployed', () => {
    const result = mergeFunctionData(repos, deployments);

    expect(result[1]).toEqual({
      name: 'issue-744-go-func',
      namespace: '',
      runtime: '',
      status: 'NotDeployed',
      replicas: 0,
    });
  });

  it('returns one item per repo', () => {
    const result = mergeFunctionData(repos, deployments);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no repos exist', () => {
    const result = mergeFunctionData([], deployments);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test -- --testPathPattern=useFunctionsList`
Expected: FAIL — `useFunctionsList` module not found

---

## Task 4: Merging Hook — Implementation

**Files:**
- Create: `src/hooks/useFunctionsList.ts`

- [ ] **Step 1: Implement useFunctionsList**

```typescript
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
  const { functions: deployments, loaded: deploymentsLoaded } = useClusterService();

  const functions = mergeFunctionData(repos, deployments);
  return { functions, loaded: reposLoaded && deploymentsLoaded };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn test -- --testPathPattern=useFunctionsList`
Expected: All 4 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFunctionsList.ts src/hooks/useFunctionsList.test.ts
git commit --author="Claude <noreply@anthropic.com>" -m "feat: add useFunctionsList merging hook

Combines GitHub repos (source of truth) with cluster
deployment status. Functions not deployed show
NotDeployed status."
```

---

## Task 5: FunctionTable Component — Tests

**Files:**
- Create: `src/components/FunctionTable.test.tsx`

- [ ] **Step 1: Write tests for FunctionTable**

```typescript
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FunctionTable } from './FunctionTable';
import { FunctionListItem } from '../services/types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

const twoFunctions: FunctionListItem[] = [
  {
    name: 'func-demo-26',
    namespace: 'demo',
    runtime: 'go',
    status: 'Running',
    url: 'http://func-demo-26.demo.svc',
    replicas: 1,
  },
  {
    name: 'issue-744-go-func',
    namespace: '',
    runtime: '',
    status: 'NotDeployed',
    replicas: 0,
  },
];

function createFunctions(count: number): FunctionListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `func-${i + 1}`,
    namespace: 'demo',
    runtime: 'node',
    status: 'Running' as const,
    url: `http://func-${i + 1}.demo.svc`,
    replicas: 1,
  }));
}

describe('FunctionTable', () => {
  it('renders column headers', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'runtime' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'url' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'replicas' })).toBeInTheDocument();
  });

  it('renders a row for each function', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it('renders function name as a link to the edit page', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'func-demo-26' });
    expect(link).toHaveAttribute('href', '/functions/edit/func-demo-26');
  });

  it('renders a shortened URL as a clickable external link', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'func-demo-26.demo.svc' });
    expect(link).toHaveAttribute('href', 'http://func-demo-26.demo.svc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders a dash when url is not set', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    const secondDataRow = rows[2];
    expect(within(secondDataRow).getByText('—')).toBeInTheDocument();
  });

  it('renders edit and delete action buttons per row', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    const editButtons = screen.getAllByRole('link', { name: 'edit' });
    expect(editButtons).toHaveLength(2);
    expect(editButtons[0]).toHaveAttribute('href', '/functions/edit/func-demo-26');

    const deleteButtons = screen.getAllByRole('button', { name: 'delete' });
    expect(deleteButtons).toHaveLength(2);
  });

  it('navigates to edit page when row is clicked', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={twoFunctions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    expect(firstDataRow).toHaveAttribute('data-href', '/functions/edit/func-demo-26');
  });

  it('paginates at 20 items by default', () => {
    const manyFunctions = createFunctions(30);

    render(
      <MemoryRouter>
        <FunctionTable functions={manyFunctions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    // 1 header row + 20 data rows (first page)
    expect(rows).toHaveLength(21);
  });

  it('does not paginate when 20 or fewer items', () => {
    const fewFunctions = createFunctions(15);

    render(
      <MemoryRouter>
        <FunctionTable functions={fewFunctions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    // 1 header row + 15 data rows
    expect(rows).toHaveLength(16);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test -- --testPathPattern=FunctionTable`
Expected: FAIL — `FunctionTable` module not found

---

## Task 6: FunctionTable Component — Implementation

**Files:**
- Create: `src/components/FunctionTable.tsx`

- [ ] **Step 1: Implement FunctionTable with pagination**

```typescript
import { useState } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { Button, Pagination, PaginationVariant } from '@patternfly/react-core';
import { PencilAltIcon, TrashIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { FunctionListItem } from '../services/types';

const PER_PAGE = 20;

function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function FunctionTable({ functions }: { functions: FunctionListItem[] }) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const history = useHistory();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);

  const paginatedFunctions = functions.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <Table aria-label={t('functions')}>
        <Thead>
          <Tr>
            <Th>{t('name')}</Th>
            <Th>{t('runtime')}</Th>
            <Th>{t('status')}</Th>
            <Th>{t('url')}</Th>
            <Th>{t('replicas')}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {paginatedFunctions.map((fn) => (
            <Tr
              key={fn.name}
              isClickable
              onRowClick={() => history.push(`/functions/edit/${fn.name}`)}
              data-href={`/functions/edit/${fn.name}`}
            >
              <Td dataLabel={t('name')}>
                <Link to={`/functions/edit/${fn.name}`}>{fn.name}</Link>
              </Td>
              <Td dataLabel={t('runtime')}>{fn.runtime}</Td>
              <Td dataLabel={t('status')}>{fn.status}</Td>
              <Td dataLabel={t('url')}>
                {fn.url ? (
                  <a href={fn.url} target="_blank" rel="noopener noreferrer">
                    {shortenUrl(fn.url)}
                  </a>
                ) : (
                  '—'
                )}
              </Td>
              <Td dataLabel={t('replicas')}>{fn.replicas}</Td>
              <Td isActionCell>
                <Link to={`/functions/edit/${fn.name}`} aria-label={t('edit')}>
                  <Button variant="plain" component="span" icon={<PencilAltIcon />} />
                </Link>{' '}
                <Button
                  variant="plain"
                  aria-label={t('delete')}
                  icon={<TrashIcon />}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {functions.length > perPage && (
        <Pagination
          itemCount={functions.length}
          perPage={perPage}
          page={page}
          onSetPage={(_e, newPage) => setPage(newPage)}
          onPerPageSelect={(_e, newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          variant={PaginationVariant.bottom}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn test -- --testPathPattern=FunctionTable`
Expected: All 9 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/FunctionTable.tsx src/components/FunctionTable.test.tsx
git commit --author="Claude <noreply@anthropic.com>" -m "feat: add FunctionTable component

PatternFly table with name, runtime, status, URL,
replicas, and action columns. Pagination at 20 items.
Clickable rows navigate to the edit view."
```

---

## Task 7: i18n Keys — camelCase Migration

**Files:**
- Modify: `locales/en/plugin__console-functions-plugin.json`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/EmptyState.test.tsx`

- [ ] **Step 1: Update i18n JSON with camelCase keys**

Replace entire contents of `locales/en/plugin__console-functions-plugin.json`:

```json
{
  "functions": "Functions",
  "noFunctionsFound": "No functions found",
  "createFunctionDescription": "Create a serverless function to get started.",
  "createFunction": "Create function",
  "name": "Name",
  "runtime": "Runtime",
  "status": "Status",
  "url": "URL",
  "replicas": "Replicas",
  "edit": "Edit",
  "delete": "Delete"
}
```

- [ ] **Step 2: Update EmptyState.tsx to use camelCase keys**

Replace contents of `src/components/EmptyState.tsx`:

```typescript
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function FunctionsEmptyState() {
  const { t } = useTranslation('plugin__console-functions-plugin');

  return (
    <EmptyState headingLevel="h2" icon={CubesIcon} titleText={t('noFunctionsFound')}>
      <EmptyStateBody>
        {t('createFunctionDescription')}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Link to="/functions/create">{t('createFunction')}</Link>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
```

- [ ] **Step 3: Update EmptyState.test.tsx assertions**

Replace contents of `src/components/EmptyState.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FunctionsEmptyState } from './EmptyState';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FunctionsEmptyState', () => {
  it('renders a heading with "noFunctionsFound"', () => {
    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'noFunctionsFound' }),
    ).toBeInTheDocument();
  });

  it('renders a "createFunction" link pointing to /functions/create', () => {
    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'createFunction' });
    expect(link).toHaveAttribute('href', '/functions/create');
  });
});
```

- [ ] **Step 4: Run full test suite**

Run: `yarn test`
Expected: All tests pass (EmptyState tests updated, FunctionTable tests use camelCase keys)

- [ ] **Step 5: Commit**

```bash
git add locales/en/plugin__console-functions-plugin.json src/components/EmptyState.tsx src/components/EmptyState.test.tsx
git commit --author="Claude <noreply@anthropic.com>" -m "refactor: migrate i18n keys to camelCase

Replaces sentence-case keys with short camelCase keys
across EmptyState component and translation file."
```

---

## Task 8: FunctionsListPage — Tests

**Files:**
- Modify: `src/views/FunctionsListPage.test.tsx`

- [ ] **Step 1: Rewrite the test file with hook mocks and new tests**

Replace the entire contents of `src/views/FunctionsListPage.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FunctionsListPage from './FunctionsListPage';
import { useFunctionsList } from '../hooks/useFunctionsList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  DocumentTitle: ({ children }: { children: string }) => children,
  ListPageHeader: ({ title }: { title: string }) => title,
}));

jest.mock('../hooks/useFunctionsList', () => ({
  useFunctionsList: jest.fn(),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

const emptyResult = { functions: [], loaded: true };

const populatedResult = {
  functions: [
    {
      name: 'func-demo-26',
      namespace: 'demo',
      runtime: 'go',
      status: 'Running' as const,
      url: 'http://func-demo-26.demo.svc',
      replicas: 1,
    },
  ],
  loaded: true,
};

describe('FunctionsListPage', () => {
  it('renders the empty state when no functions exist', () => {
    (useFunctionsList as jest.Mock).mockReturnValue(emptyResult);

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'noFunctionsFound' }),
    ).toBeInTheDocument();
  });

  it('renders a "createFunction" link to /functions/create', () => {
    (useFunctionsList as jest.Mock).mockReturnValue(emptyResult);

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('link', { name: 'createFunction' }),
    ).toHaveAttribute('href', '/functions/create');
  });

  it('renders the function table when functions exist', () => {
    (useFunctionsList as jest.Mock).mockReturnValue(populatedResult);

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'func-demo-26' })).toHaveAttribute(
      'href',
      '/functions/edit/func-demo-26',
    );
  });

  it('does not render the empty state when functions exist', () => {
    (useFunctionsList as jest.Mock).mockReturnValue(populatedResult);

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('heading', { name: 'noFunctionsFound' }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test -- --testPathPattern=FunctionsListPage`
Expected: FAIL — `useFunctionsList` not consumed in view yet

---

## Task 9: FunctionsListPage — Implementation

**Files:**
- Modify: `src/views/FunctionsListPage.tsx`

- [ ] **Step 1: Update FunctionsListPage to use useFunctionsList**

Replace entire contents of `src/views/FunctionsListPage.tsx`:

```typescript
import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { PageSection } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { FunctionsEmptyState } from '../components/EmptyState';
import { FunctionTable } from '../components/FunctionTable';
import { useFunctionsList } from '../hooks/useFunctionsList';

export default function FunctionsListPage() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { functions } = useFunctionsList();

  return (
    <>
      <DocumentTitle>{t('functions')}</DocumentTitle>
      <ListPageHeader title={t('functions')} />
      <PageSection>
        {functions.length > 0 ? (
          <FunctionTable functions={functions} />
        ) : (
          <FunctionsEmptyState />
        )}
      </PageSection>
    </>
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn test -- --testPathPattern=FunctionsListPage`
Expected: All 4 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/views/FunctionsListPage.tsx src/views/FunctionsListPage.test.tsx
git commit --author="Claude <noreply@anthropic.com>" -m "feat: wire list page with useFunctionsList hook

Renders FunctionTable when functions exist, shows
FunctionsEmptyState otherwise. Uses merged data from
GitHub repos and cluster deployments."
```

---

## Task 10: E2e Tests

**Files:**
- Create: `e2e/function-list-table/function-list-table.test.ts`

- [ ] **Step 1: Write Cypress e2e test**

```typescript
describe('Function List Table', () => {
  beforeEach(() => {
    cy.visit('/functions');
  });

  it('renders the function table with hardcoded data', () => {
    cy.get('table').should('exist');
    cy.get('th').should('contain', 'Name');
    cy.get('th').should('contain', 'Runtime');
    cy.get('th').should('contain', 'Status');
    cy.get('th').should('contain', 'URL');
    cy.get('th').should('contain', 'Replicas');
  });

  it('renders function rows from hardcoded data', () => {
    cy.get('tbody tr').should('have.length.at.least', 1);
    cy.get('tbody tr').first().should('contain', 'func-demo-26');
  });

  it('navigates to edit page when function name is clicked', () => {
    cy.get('a').contains('func-demo-26').click();
    cy.url().should('include', '/functions/edit/func-demo-26');
  });
});
```

- [ ] **Step 2: Run e2e tests (requires dev server running)**

Run: `yarn test-cypress-headless`
Expected: All 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/function-list-table/function-list-table.test.ts
git commit --author="Claude <noreply@anthropic.com>" -m "test: add e2e tests for function list table

Cypress tests verify table renders, shows data,
and navigates to edit page on click."
```

---

## Task 11: Finalize

**Files:**
- Modify: `docs/claude-progress.txt`
- Modify: `docs/features.json`

- [ ] **Step 1: Update claude-progress.txt**

Add entry at the top (after the header):

```markdown
---
## 2026-03-31 | Session: Function list table feature
Worked on: Implemented function list table with hardcoded real API data
Completed:
- DeployedFunction, RepoInfo, FunctionListItem types (services/types.ts)
- useClusterService hook skeleton with hardcoded K8s data
- useSourceControl hook skeleton with hardcoded GitHub data
- useFunctionsList merging hook (repos + deployments → table data)
- FunctionTable component with PatternFly table + pagination (20/page)
- FunctionsListPage wired with conditional empty state vs table
- Migrated i18n keys to camelCase convention
- E2e tests with Cypress
Left off: Create form page
Blockers: None
```

- [ ] **Step 2: Mark feature as passing in features.json**

Set `"passes": true` for the "Function List Page renders a table with function entries" feature.

- [ ] **Step 3: Commit**

```bash
git add docs/claude-progress.txt docs/features.json
git commit --author="Claude <noreply@anthropic.com>" -m "chore: mark function list table as passing

Update progress log and features.json."
```
