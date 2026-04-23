import { render, screen, act } from '@testing-library/react';
import { useUserAvatar } from './useUserAvatar';

const mockSetPat = jest.fn();
const mockClearPat = jest.fn();
let mockPatValue = '';
let mockUserValue: { login: string; avatarUrl: string } | null = null;

jest.mock('../contexts/PatContext', () => ({
  usePatContext: () => ({
    pat: mockPatValue,
    user: mockUserValue,
    setPat: mockSetPat,
    clearPat: mockClearPat,
  }),
}));

const mockValidatePat = jest.fn();
jest.mock('../services/source-control/GithubService', () => ({
  GithubService: jest.fn().mockImplementation(() => ({
    validatePat: mockValidatePat,
  })),
}));

function TestConsumer() {
  const { isConnected, user, validating, error, submitPat, clearError } = useUserAvatar();
  return (
    <div>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="user">{user ? user.login : 'null'}</span>
      <span data-testid="validating">{String(validating)}</span>
      <span data-testid="error">{error ?? 'null'}</span>
      <button onClick={() => submitPat('ghp_new')}>submit</button>
      <button onClick={clearError}>clearError</button>
    </div>
  );
}

afterEach(() => {
  mockPatValue = '';
  mockUserValue = null;
  jest.clearAllMocks();
});

describe('useUserAvatar', () => {
  it('returns isConnected false when no PAT', () => {
    render(<TestConsumer />);

    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('returns isConnected true and user when PAT is set', () => {
    mockPatValue = 'ghp_existing';
    mockUserValue = { login: 'twoGiants', avatarUrl: 'https://avatar' };

    render(<TestConsumer />);

    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('twoGiants');
  });

  it('validates and stores PAT on submitPat success, returns true', async () => {
    mockValidatePat.mockResolvedValue({ login: 'twoGiants', avatarUrl: 'https://avatar' });

    render(<TestConsumer />);

    await act(async () => {
      screen.getByText('submit').click();
    });

    expect(mockSetPat).toHaveBeenCalledWith('ghp_new', {
      login: 'twoGiants',
      avatarUrl: 'https://avatar',
    });
  });

  it('sets error on submitPat failure, returns false', async () => {
    mockValidatePat.mockRejectedValue(new Error('Bad credentials'));

    render(<TestConsumer />);

    await act(async () => {
      screen.getByText('submit').click();
    });

    expect(screen.getByTestId('error').textContent).toBe('Bad credentials');
    expect(mockSetPat).not.toHaveBeenCalled();
  });
});
