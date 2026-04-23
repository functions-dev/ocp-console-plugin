import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePatContext } from '../hooks/usePatContext';
import { UserAvatar } from './UserAvatar';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../hooks/usePatContext');

const mockUsePatContext = jest.mocked(usePatContext);
const mockOpenModal = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePatContext.mockReturnValue({
    isConnected: false,
    username: null,
    isModalOpen: false,
    openModal: mockOpenModal,
    closeModal: jest.fn(),
    submitPat: jest.fn(),
    error: null,
  });
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

  it('does not call openModal when clicked and clickable is false', async () => {
    const user = userEvent.setup();

    render(<UserAvatar />);

    await user.click(screen.getByText('Connect to GitHub'));
    expect(mockOpenModal).not.toHaveBeenCalled();
  });
});

describe('UserAvatar — connected', () => {
  beforeEach(() => {
    mockUsePatContext.mockReturnValue({
      isConnected: true,
      username: 'twoGiants',
      isModalOpen: false,
      openModal: mockOpenModal,
      closeModal: jest.fn(),
      submitPat: jest.fn(),
      error: null,
    });
  });

  it('renders username when connected and clickable', () => {
    render(<UserAvatar clickable />);

    expect(screen.getByText('twoGiants')).toBeInTheDocument();
  });

  it('renders username as plain text when not clickable', () => {
    render(<UserAvatar />);

    expect(screen.getByText(/twoGiants/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
