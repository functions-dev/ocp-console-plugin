import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserAvatar } from './UserAvatar';
import { TOKEN_KEY, USER_KEY } from '../services/types';
import { ForgeConnectionContext } from '../context/ForgeConnectionProvider';
import { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockFetchUserInfo = vi.fn();
vi.mock('../services/source-control/useSourceControlService', () => ({
  useSourceControlService: () => ({
    fetchUserInfo: mockFetchUserInfo,
  }),
}));

const mockFetchConfig = vi.fn().mockResolvedValue({ enabled: false, client_id: '' });
const mockStartFlow = vi.fn();
vi.mock('../services/oauth/useOAuthService', () => ({
  useOAuthService: () => ({
    fetchConfig: mockFetchConfig,
    startFlow: mockStartFlow,
  }),
}));

const testUser = { name: 'twoGiants' };

function renderWithContext(
  ui: ReactNode,
  contextValue = {
    isActive: false,
    user: testUser,
    connectionId: 0,
    connectToForge: vi.fn(),
    disconnectFromForge: vi.fn(),
  },
) {
  return render(
    <ForgeConnectionContext.Provider value={contextValue}>{ui}</ForgeConnectionContext.Provider>,
  );
}

describe('UserAvatar', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    sessionStorage.clear();
  });

  describe('rendering', () => {
    it('renders "Connect to GitHub" when no user is stored', () => {
      renderWithContext(<UserAvatar enableReconnect={false} />);

      expect(screen.getByText('Connect to GitHub')).toBeInTheDocument();
    });

    it('renders username when user is stored in sessionStorage', () => {
      sessionStorage.setItem(TOKEN_KEY, 'ghp_test');
      sessionStorage.setItem(USER_KEY, JSON.stringify(testUser));

      renderWithContext(<UserAvatar enableReconnect />);

      expect(screen.getByText('twoGiants')).toBeInTheDocument();
    });

    it('shows dropdown when logged-in user is clicked', async () => {
      const user = userEvent.setup();
      sessionStorage.setItem(TOKEN_KEY, 'ghp_test');
      sessionStorage.setItem(USER_KEY, JSON.stringify(testUser));

      renderWithContext(<UserAvatar enableReconnect />);

      await user.click(screen.getByRole('button', { name: 'twoGiants' }));

      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('button is disabled when enableReconnect is false', async () => {
      const user = userEvent.setup();

      renderWithContext(<UserAvatar enableReconnect={false} />);

      const button = screen.getByRole('button', { name: 'Connect to GitHub' });
      expect(button).toBeDisabled();

      await user.click(button);
      expect(screen.queryByText('Personal Access Token')).not.toBeInTheDocument();
    });
  });

  describe('modal auto-open', () => {
    it('opens modal automatically when enableReconnect is true and no PAT stored', () => {
      renderWithContext(<UserAvatar enableReconnect />);

      expect(screen.getByText('Personal Access Token')).toBeInTheDocument();
    });

    it('does not auto-open modal when PAT is already stored', () => {
      sessionStorage.setItem(TOKEN_KEY, 'ghp_test');
      sessionStorage.setItem(USER_KEY, JSON.stringify(testUser));

      renderWithContext(<UserAvatar enableReconnect />);

      expect(screen.queryByText('Personal Access Token')).not.toBeInTheDocument();
    });

    it('does not auto-open modal when enableReconnect is false', () => {
      renderWithContext(<UserAvatar enableReconnect={false} />);

      expect(screen.queryByText('Personal Access Token')).not.toBeInTheDocument();
    });
  });

  describe('PAT modal', () => {
    it('Connect button disabled when input is empty', () => {
      renderWithContext(<UserAvatar enableReconnect />);

      expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
    });

    it('calls fetchUserInfo with PAT and updates UI on successful connect', async () => {
      const user = userEvent.setup();
      const connectToForge = vi.fn();
      mockFetchUserInfo.mockResolvedValue(testUser);

      renderWithContext(<UserAvatar enableReconnect />, {
        isActive: false,
        user: testUser,
        connectionId: 0,
        connectToForge,
        disconnectFromForge: vi.fn(),
      });

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_valid');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      await waitFor(() => {
        expect(mockFetchUserInfo).toHaveBeenCalledWith('ghp_valid');
      });

      expect(screen.getByText('twoGiants')).toBeInTheDocument();
      expect(sessionStorage.getItem(TOKEN_KEY)).toBe('ghp_valid');
      expect(JSON.parse(sessionStorage.getItem(USER_KEY)!)).toEqual(testUser);
      expect(connectToForge).toHaveBeenCalled();
    });

    it('shows error alert when fetchUserInfo rejects', async () => {
      const user = userEvent.setup();
      mockFetchUserInfo.mockRejectedValue(new Error('Bad credentials'));

      renderWithContext(<UserAvatar enableReconnect />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_bad');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
    });

    it('closes modal when Cancel is clicked', async () => {
      const user = userEvent.setup();

      renderWithContext(<UserAvatar enableReconnect />);

      expect(screen.getByText('Personal Access Token')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('Personal Access Token')).not.toBeInTheDocument();
    });

    it('shows dropdown after successful connect', async () => {
      const user = userEvent.setup();
      const connectToForge = vi.fn();
      mockFetchUserInfo.mockResolvedValue(testUser);

      renderWithContext(<UserAvatar enableReconnect />, {
        isActive: false,
        user: testUser,
        connectionId: 0,
        connectToForge,
        disconnectFromForge: vi.fn(),
      });

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_valid');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      await waitFor(() => {
        expect(screen.getByText('twoGiants')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'twoGiants' }));

      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('clears PAT input and error on cancel', async () => {
      const user = userEvent.setup();
      mockFetchUserInfo.mockRejectedValue(new Error('Bad credentials'));

      renderWithContext(<UserAvatar enableReconnect />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_bad');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      expect(await screen.findByText('Bad credentials')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Connect to GitHub' }));

      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
      expect(screen.queryByText('Bad credentials')).not.toBeInTheDocument();
    });

    it('disables Cancel button while validating', async () => {
      const user = userEvent.setup();
      let resolveConnect: () => void;
      mockFetchUserInfo.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
      );

      renderWithContext(<UserAvatar enableReconnect />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_slow');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      resolveConnect!();
    });
  });

  describe('disconnect', () => {
    it('shows confirmation modal and disconnects on confirm', async () => {
      const user = userEvent.setup();
      sessionStorage.setItem(TOKEN_KEY, 'ghp_test');
      sessionStorage.setItem(USER_KEY, JSON.stringify(testUser));

      renderWithContext(<UserAvatar enableReconnect />);

      await user.click(screen.getByRole('button', { name: 'twoGiants' }));
      await user.click(screen.getByRole('menuitem', { name: 'Disconnect' }));

      expect(screen.getByText('Disconnect from GitHub')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Disconnect' }));

      expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(sessionStorage.getItem(USER_KEY)).toBeNull();
      expect(screen.getByText('Connect to GitHub')).toBeInTheDocument();
    });
  });
});
