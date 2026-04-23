import { render, screen, waitFor } from '@testing-library/react';
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
});
