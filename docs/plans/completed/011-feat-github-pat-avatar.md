# GitHub PAT Avatar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace compile-time PAT injection (webpack DefinePlugin) with runtime PAT entry: a modal prompts the user for their PAT on first visit, validates it against the GitHub API, stores it in sessionStorage, and displays the authenticated GitHub user in every page header.

**Architecture:** React Context provides cross-cutting PAT state. Since OCP dynamic plugins register routes individually (each page renders independently), every view wraps itself with a `PatProvider`. `sessionStorage` is the source of truth, React state is a page-local cache hydrated from it on mount.

```
Types: GitHubUser
Services: validatePat() on SourceControlService/GithubService
Context: PatContext (pat, user, setPat, clearPat)
Hooks: useUserAvatar (submitPat, isConnected, user, validating, error)
       useSourceControlService rewritten to read PAT from context
Components: PatModal, UserAvatar, PageWrapper
Views: all three pages updated
```

**Constraints:**
- @testing-library/react v12: no renderHook. Use TestConsumer component pattern for hook tests.
- PF6 Modal: composable API with Modal > ModalHeader + ModalBody + ModalFooter children. No actions or title prop on Modal.
- React 17: hooks must follow React 17 rules.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/services/types.ts` | Add `GitHubUser` interface |
| Modify | `src/services/source-control/SourceControlService.ts` | Add `validatePat()` to interface |
| Modify | `src/services/source-control/GithubService.ts` | Implement `validatePat()` via `octokit.users.getAuthenticated()` |
| Modify | `src/services/source-control/SourceControlService.test.ts` | Add validatePat test cases |
| Modify | `src/services/source-control/useSourceControlService.ts` | Rewrite to read PAT from context |
| Create | `src/contexts/PatContext.tsx` | React Context + Provider for PAT state |
| Create | `src/contexts/PatContext.test.tsx` | Context tests |
| Create | `src/hooks/useUserAvatar.ts` | Hook encapsulating PAT validation logic |
| Create | `src/hooks/useUserAvatar.test.tsx` | Hook tests |
| Create | `src/components/PatModal.tsx` | PF6 composable Modal for PAT entry |
| Create | `src/components/PatModal.test.tsx` | Modal tests |
| Create | `src/components/UserAvatar.tsx` | Avatar component (connected/disconnected states) |
| Create | `src/components/UserAvatar.test.tsx` | Avatar tests |
| Create | `src/components/PageWrapper.tsx` | Wraps children with PatProvider |
| Modify | `src/components/EmptyState.tsx` | Add `isCreateDisabled` prop |
| Modify | `src/components/EmptyState.test.tsx` | Test disabled state |
| Modify | `src/views/FunctionsListPage.tsx` | Wrap with PageWrapper, add UserAvatar, PatModal, hint alert |
| Modify | `src/views/FunctionsListPage.test.tsx` | Add new test cases |
| Modify | `src/views/FunctionCreatePage.tsx` | Wrap with PageWrapper, add non-clickable UserAvatar |
| Modify | `src/views/FunctionCreatePage.test.tsx` | Add avatar test |
| Modify | `src/views/FunctionEditPage.tsx` | Wrap with PageWrapper, add non-clickable UserAvatar |
| Modify | `src/globals.d.ts` | Remove `__GITHUB_PAT__` declaration |
| Modify | `webpack.config.ts` | Remove DefinePlugin for `__GITHUB_PAT__` |

---

### Task 1: Add GitHubUser type

**Files:** `src/services/types.ts`

- [x] **Step 1:** Add `GitHubUser` interface with `login` and `avatarUrl` fields

---

### Task 2: Add validatePat to SourceControlService + GithubService (TDD)

**Files:** `src/services/source-control/SourceControlService.ts`, `GithubService.ts`, `SourceControlService.test.ts`

- [x] **Step 1:** Add `validatePat(): Promise<GitHubUser>` to SourceControlService interface
- [x] **Step 2:** Implement in GithubService using `octokit.users.getAuthenticated()`
- [x] **Step 3:** Write tests: valid PAT returns user, invalid PAT throws
- [x] **Step 4:** Refactor mock to use `mockGetAuthenticated` variable

---

### Task 3: Create PatContext (TDD)

**Files:** `src/contexts/PatContext.tsx`, `src/contexts/PatContext.test.tsx`

- [x] **Step 1:** Create PatProvider with sessionStorage-backed state
- [x] **Step 2:** Create usePatContext consumer hook
- [x] **Step 3:** Write 5 tests using TestConsumer pattern

---

### Task 4: Rewrite useSourceControlService

**Files:** `src/services/source-control/useSourceControlService.ts`

- [x] **Step 1:** Replace compile-time singleton with context-driven hook using `usePatContext` + `useMemo`

---

### Task 5: Create useUserAvatar hook (TDD)

**Files:** `src/hooks/useUserAvatar.ts`, `src/hooks/useUserAvatar.test.tsx`

- [x] **Step 1:** Implement hook with submitPat, isConnected, user, validating, error, clearError
- [x] **Step 2:** Write 4 tests using TestConsumer pattern

---

### Task 6: Create PatModal component (TDD)

**Files:** `src/components/PatModal.tsx`, `src/components/PatModal.test.tsx`

- [x] **Step 1:** Implement PF6 composable Modal with ModalHeader + ModalBody + ModalFooter
- [x] **Step 2:** Write 7 tests mocking useUserAvatar

---

### Task 7: Create UserAvatar component (TDD)

**Files:** `src/components/UserAvatar.tsx`, `src/components/UserAvatar.test.tsx`

- [x] **Step 1:** Implement two states (connected/disconnected) with clickable prop
- [x] **Step 2:** Write 5 tests mocking useUserAvatar and PatModal

---

### Task 8: Create PageWrapper component

**Files:** `src/components/PageWrapper.tsx`

- [x] **Step 1:** Create trivial wrapper around PatProvider

---

### Task 9: Update FunctionsEmptyState (TDD)

**Files:** `src/components/EmptyState.tsx`, `src/components/EmptyState.test.tsx`

- [x] **Step 1:** Add `isCreateDisabled` prop with Tooltip on disabled button
- [x] **Step 2:** Write 1 test for disabled state

---

### Task 10: Update FunctionsListPage (TDD)

**Files:** `src/views/FunctionsListPage.tsx`, `src/views/FunctionsListPage.test.tsx`

- [x] **Step 1:** Wrap with PageWrapper, add UserAvatar, PatModal auto-open, hint alert, disabled Create button
- [x] **Step 2:** Write 6 new tests with PatContext/UserAvatar/PatModal mocks

---

### Task 11: Update FunctionCreatePage

**Files:** `src/views/FunctionCreatePage.tsx`, `src/views/FunctionCreatePage.test.tsx`

- [x] **Step 1:** Wrap with PageWrapper, add non-clickable UserAvatar
- [x] **Step 2:** Write 1 test for non-clickable avatar

---

### Task 12: Update FunctionEditPage

**Files:** `src/views/FunctionEditPage.tsx`

- [x] **Step 1:** Wrap with PageWrapper, add non-clickable UserAvatar

---

### Task 13: Remove compile-time PAT injection

**Files:** `src/globals.d.ts`, `webpack.config.ts`

- [x] **Step 1:** Remove `__GITHUB_PAT__` declaration from globals.d.ts
- [x] **Step 2:** Remove DefinePlugin entry from webpack.config.ts
- [x] **Step 3:** Remove unused DefinePlugin import

---

### Task 14: Verification

- [x] **Step 1:** All 65 tests pass across 12 suites
- [x] **Step 2:** Zero TypeScript errors in source code
- [x] **Step 3:** Create plan file, update features.json and claude-progress.txt
