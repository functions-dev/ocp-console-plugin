# GitHub PAT Avatar — Design Spec

## Overview

Replace the compile-time GitHub PAT injection with a runtime session-based flow. Users enter their PAT via a modal on first visit to the Function List Page. A header avatar component shows connection status across all pages.

## Service Layer

### SourceControlService interface

Two new methods:

```ts
export interface SourceControlService {
  init(pat: string): Promise<string>;        // validates PAT via GitHub API, returns username
  isInitialized(): boolean;
  listFunctionRepos(): Promise<SourceRepo[]>;
  fetchFileContent(repo: SourceRepo, path: string): Promise<string>;
  push(repo: RepoInfo, files: FileEntry[], message: string): Promise<void>;
}
```

### GithubService changes

- Constructor takes no arguments (empty/uninitialized state).
- `init(pat)`: creates a new `Octokit({ auth: pat })`, calls `octokit.users.getAuthenticated()` to validate. Caches the username internally. Returns the username on success, throws on failure.
- `isInitialized()`: returns `true` after a successful `init()` call.
- `getUsername()`: returns the cached username or `undefined`.
- `listFunctionRepos()`, `push()`, `fetchFileContent()` throw if not initialized.

### Removals

- Remove `__GITHUB_PAT__` from webpack DefinePlugin in `webpack.config.ts`.
- Remove `__GITHUB_PAT__` declaration from `src/globals.d.ts`.
- Remove compile-time PAT injection from `useSourceControlService.ts`. The singleton is constructed without a PAT.

## PAT Context (React Context — Approach B)

### `src/hooks/usePatContext.ts`

Defines the context shape and the consumer hook:

```ts
interface PatContextValue {
  isConnected: boolean;
  username: string | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  submitPat: (pat: string) => Promise<void>;
  error: string | null;
}
```

`usePatContext()` calls `useContext(PatContext)` and returns the value.

### `src/components/PatProvider.tsx`

The provider component. Manages:

- **Mount**: reads PAT from `sessionStorage` key `faas-gh-pat`. If found, calls `service.init(pat)` to restore the session (sets `isConnected`, `username`).
- **`submitPat(pat)`**: calls `service.init(pat)`. On success: stores PAT in sessionStorage under `faas-gh-pat`, sets `isConnected: true`, sets `username`, clears error, closes modal. On failure: sets error message (e.g. "Invalid token"), keeps modal open.
- **`closeModal()`**: closes modal, sets `faas-gh-pat-modal-shown` flag in sessionStorage.
- **`openModal()`**: opens modal, clears any previous error.

Imports the service via `useSourceControlService()`.

## UI Components

### `src/components/PatModal.tsx`

- PatternFly `Modal` component.
- Single `TextInput` (type `password`) for the PAT.
- "Connect" primary button and "Cancel" button.
- Inline `Alert` (variant `danger`) for validation errors from context.
- Connect button calls `submitPat(pat)` from `usePatContext()`.
- Cancel calls `closeModal()` from `usePatContext()`.
- No props — reads everything from context.

### `src/components/UserAvatar.tsx`

- **Not connected**: button with `KeyIcon` and "Connect to GitHub" text.
- **Connected**: username text with `UserIcon`.
- `clickable` prop (boolean):
  - `true` (List page): clicking calls `openModal()` from context.
  - `false` (Create/Edit pages): plain text, no click handler.
- Reads `isConnected`, `username`, `openModal` from `usePatContext()`.

### `src/components/EmptyState.tsx` — modification

When `!isConnected` (from `usePatContext()`), show hint text below the empty state body directing the user to click "Connect to GitHub" in the top-right corner.

## View Changes

### `src/views/FunctionsListPage.tsx`

- Wraps content in `<PatProvider>`.
- Renders `<UserAvatar clickable />` as a child of `<ListPageHeader>`.
- Renders `<PatModal />` (always in tree, visibility controlled by context).
- On mount: if `!isConnected` and `faas-gh-pat-modal-shown` is not set in sessionStorage, calls `openModal()` (auto-open once per session).
- The "Create new function" button gets `isDisabled={!isConnected}` with a PatternFly `Tooltip`: "Connect to GitHub to create functions".
- `useFunctionListPage` receives `isConnected` — skips `sourceControl.listFunctionRepos()` when `false`, sets `reposLoaded: true` immediately with empty items.
- When `!isConnected` and the table is visible, hint text appears directing the user to connect.

### `src/views/FunctionCreatePage.tsx`

- Wraps content in `<PatProvider>`.
- Renders `<UserAvatar clickable={false} />` as a child of `<ListPageHeader>`.

### `src/views/FunctionEditPage.tsx`

- Wraps content in `<PatProvider>`.
- Renders `<UserAvatar clickable={false} />` as a child of `<ListPageHeader>`.

## Data Flow

### First visit (no PAT stored)

1. User navigates to `/faas`.
2. `PatProvider` mounts, reads sessionStorage — no PAT found.
3. List page checks `!isConnected && !modalShown` — calls `openModal()`.
4. PatModal appears automatically.
5. User enters PAT, clicks Connect.
6. `submitPat(pat)` calls `service.init(pat)` which calls `octokit.users.getAuthenticated()`.
7. On success: PAT stored in sessionStorage (`faas-gh-pat`), username set in context.
8. Modal closes, `isConnected` becomes `true`.
9. `useFunctionListPage` sees `isConnected` change — runs `listFunctionRepos()` effect.
10. Table renders with function data.

### Dismiss without PAT

1. User clicks Cancel on PatModal.
2. `closeModal()` sets `faas-gh-pat-modal-shown` flag in sessionStorage.
3. `isConnected` remains `false`.
4. List page shows empty state with hint text. Create button disabled with tooltip.
5. User clicks "Connect to GitHub" in the header at any time to reopen the modal.

### Page refresh

1. `PatProvider` mounts, reads `faas-gh-pat` from sessionStorage — found.
2. Calls `service.init(pat)` to restore Octokit instance and username.
3. `isConnected` becomes `true` after init resolves.
4. Page renders normally with data.

### Navigate to Create/Edit

1. `PatProvider` mounts, reads PAT from sessionStorage — restores connection.
2. `UserAvatar` shows username, not clickable.
3. No modal auto-open on these pages (only on List page).

## sessionStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `faas-gh-pat` | PAT string | The GitHub personal access token |
| `faas-gh-pat-modal-shown` | `"true"` | Prevents auto-open after dismiss (once per session) |

## File Inventory

### New files

| File | Layer | Purpose |
|------|-------|---------|
| `src/hooks/usePatContext.ts` | Hooks | Context definition + `usePatContext()` consumer hook |
| `src/components/PatProvider.tsx` | Components | Context provider — sessionStorage, service init, modal state |
| `src/components/PatProvider.test.tsx` | Test | Provider lifecycle: mount with/without stored PAT, submitPat, closeModal |
| `src/components/PatModal.tsx` | Components | PAT entry modal |
| `src/components/PatModal.test.tsx` | Test | Renders inputs, submit calls context, error display, cancel closes |
| `src/components/UserAvatar.tsx` | Components | Header avatar with connected/disconnected states |
| `src/components/UserAvatar.test.tsx` | Test | Renders both states, clickable vs non-clickable, calls openModal |

### Modified files

| File | Change |
|------|--------|
| `src/services/source-control/SourceControlService.ts` | Add `init()`, `isInitialized()` |
| `src/services/source-control/GithubService.ts` | Implement `init()`, `isInitialized()`, `getUsername()`, remove constructor PAT |
| `src/services/source-control/useSourceControlService.ts` | Remove `__GITHUB_PAT__` injection, construct empty singleton |
| `src/services/source-control/SourceControlService.test.ts` | Add tests for init/isInitialized |
| `src/globals.d.ts` | Remove `__GITHUB_PAT__` declaration |
| `src/components/EmptyState.tsx` | Add hint text when not connected |
| `src/components/EmptyState.test.tsx` | Test hint text rendering |
| `src/views/FunctionsListPage.tsx` | Wrap in PatProvider, add UserAvatar, auto-open logic, disable Create button |
| `src/views/FunctionsListPage.test.tsx` | Test modal auto-open, disabled button, hint text |
| `src/views/FunctionCreatePage.tsx` | Wrap in PatProvider, add UserAvatar (non-clickable) |
| `src/views/FunctionCreatePage.test.tsx` | Test avatar renders non-clickable |
| `src/views/FunctionEditPage.tsx` | Wrap in PatProvider, add UserAvatar (non-clickable) |
| `webpack.config.ts` | Remove `GITHUB_PAT` DefinePlugin entry |

## Not in scope

- No avatar image fetched from GitHub (just username text + icon).
- No PAT expiration or refresh handling.
- No cluster-only data display without PAT (next feature).
