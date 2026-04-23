import { render, screen } from '@testing-library/react';
import { UserAvatar } from './UserAvatar';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mockIsConnected = false;
let mockUser: { login: string; avatarUrl: string } | null = null;

jest.mock('../hooks/useUserAvatar', () => ({
  useUserAvatar: () => ({
    isConnected: mockIsConnected,
    user: mockUser,
  }),
}));

jest.mock('./PatModal', () => ({
  PatModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="pat-modal">modal</div> : null,
}));

afterEach(() => {
  mockIsConnected = false;
  mockUser = null;
  jest.clearAllMocks();
});

describe('UserAvatar', () => {
  it('renders "Connect to GitHub" when not connected', () => {
    render(<UserAvatar clickable />);

    expect(screen.getByText('Connect to GitHub')).toBeInTheDocument();
  });

  it('renders username when connected', () => {
    mockIsConnected = true;
    mockUser = { login: 'twoGiants', avatarUrl: 'https://avatar' };

    render(<UserAvatar clickable />);

    expect(screen.getByText('twoGiants')).toBeInTheDocument();
  });

  it('opens PatModal when clicked and clickable', () => {
    render(<UserAvatar clickable />);

    expect(screen.queryByTestId('pat-modal')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Connect to GitHub' }).click();

    expect(screen.getByTestId('pat-modal')).toBeInTheDocument();
  });

  it('does not render as button when clickable is false', () => {
    render(<UserAvatar clickable={false} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders username as non-interactive when clickable is false and connected', () => {
    mockIsConnected = true;
    mockUser = { login: 'twoGiants', avatarUrl: 'https://avatar' };

    render(<UserAvatar clickable={false} />);

    expect(screen.getByText(/twoGiants/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
