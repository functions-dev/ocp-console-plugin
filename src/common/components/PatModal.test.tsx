import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatModal } from './PatModal';
import { OAuthConfig } from '../services/oauth/OAuthService';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('PatModal', () => {
  const defaultProps = {
    isOpen: true,
    oauthConfig: null as OAuthConfig | null,
    onClose: vi.fn(),
    onConnect: vi.fn().mockResolvedValue(undefined),
    onOAuth: vi.fn().mockResolvedValue(undefined),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders modal title and form elements', () => {
      render(<PatModal {...defaultProps} />);

      expect(screen.getByText('Connect to GitHub')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign in with GitHub/ })).toBeInTheDocument();
      expect(screen.getByText('or')).toBeInTheDocument();
      expect(screen.getByLabelText('Personal Access Token')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not render content when closed', () => {
      render(<PatModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Connect to GitHub')).not.toBeInTheDocument();
    });
  });

  describe('OAuth button', () => {
    it('is aria-disabled when oauthConfig is null', () => {
      render(<PatModal {...defaultProps} oauthConfig={null} />);

      expect(screen.getByRole('button', { name: /Sign in with GitHub/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('is aria-disabled when oauth is not enabled', () => {
      render(<PatModal {...defaultProps} oauthConfig={{ enabled: false, client_id: '' }} />);

      expect(screen.getByRole('button', { name: /Sign in with GitHub/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('is active when oauth is configured', () => {
      render(<PatModal {...defaultProps} oauthConfig={{ enabled: true, client_id: 'test-id' }} />);

      expect(screen.getByRole('button', { name: /Sign in with GitHub/ })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('calls onOAuth when clicked and enabled', async () => {
      const onOAuth = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <PatModal
          {...defaultProps}
          oauthConfig={{ enabled: true, client_id: 'test-id' }}
          onOAuth={onOAuth}
        />,
      );

      await user.click(screen.getByRole('button', { name: /Sign in with GitHub/ }));

      expect(onOAuth).toHaveBeenCalledOnce();
    });

    it('shows error when OAuth flow fails', async () => {
      const onOAuth = vi.fn().mockRejectedValue(new Error('Popup blocked'));
      const user = userEvent.setup();

      render(
        <PatModal
          {...defaultProps}
          oauthConfig={{ enabled: true, client_id: 'test-id' }}
          onOAuth={onOAuth}
        />,
      );

      await user.click(screen.getByRole('button', { name: /Sign in with GitHub/ }));

      expect(await screen.findByText('Popup blocked')).toBeInTheDocument();
    });
  });

  describe('PAT input', () => {
    it('Connect button is disabled when input is empty', () => {
      render(<PatModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
    });

    it('Connect button is enabled when input has value', async () => {
      const user = userEvent.setup();

      render(<PatModal {...defaultProps} />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_test');

      expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
    });

    it('calls onConnect with PAT value', async () => {
      const onConnect = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<PatModal {...defaultProps} onConnect={onConnect} />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_valid');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalledWith('ghp_valid');
      });
    });

    it('clears PAT input after successful connect', async () => {
      const onConnect = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<PatModal {...defaultProps} onConnect={onConnect} />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_valid');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
      });
    });

    it('shows error when connect fails', async () => {
      const onConnect = vi.fn().mockRejectedValue(new Error('Bad credentials'));
      const user = userEvent.setup();

      render(<PatModal {...defaultProps} onConnect={onConnect} />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_bad');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
    });

    it('disables Cancel while validating', async () => {
      const user = userEvent.setup();
      let resolveConnect: () => void;
      const onConnect = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
      );

      render(<PatModal {...defaultProps} onConnect={onConnect} />);

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_slow');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      resolveConnect!();
    });
  });

  describe('close', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<PatModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('clears PAT and error on cancel', async () => {
      const onConnect = vi.fn().mockRejectedValue(new Error('Bad credentials'));
      const onClose = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <PatModal {...defaultProps} onConnect={onConnect} onClose={onClose} />,
      );

      await user.type(screen.getByLabelText('Personal Access Token'), 'ghp_bad');
      await user.click(screen.getByRole('button', { name: 'Connect' }));

      expect(await screen.findByText('Bad credentials')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      rerender(
        <PatModal {...defaultProps} isOpen={true} onConnect={onConnect} onClose={onClose} />,
      );

      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
      expect(screen.queryByText('Bad credentials')).not.toBeInTheDocument();
    });
  });
});
