import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisconnectConfirmModal } from './DisconnectConfirmModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DisconnectConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders title and confirmation text', () => {
    render(<DisconnectConfirmModal {...defaultProps} />);

    expect(screen.getByText('Disconnect from GitHub')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to disconnect from GitHub?'),
    ).toBeInTheDocument();
  });

  it('renders Disconnect and Cancel buttons', () => {
    render(<DisconnectConfirmModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm when Disconnect is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(<DisconnectConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<DisconnectConfirmModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render content when closed', () => {
    render(<DisconnectConfirmModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Disconnect from GitHub')).not.toBeInTheDocument();
  });
});
