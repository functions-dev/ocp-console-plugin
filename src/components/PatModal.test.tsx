import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatModal } from './PatModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSubmitPat = jest.fn();
const mockCloseModal = jest.fn();
let mockError: string | null = null;

jest.mock('../hooks/usePatContext', () => ({
  usePatContext: () => ({
    isModalOpen: true,
    closeModal: mockCloseModal,
    submitPat: mockSubmitPat,
    error: mockError,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockError = null;
});

describe('PatModal', () => {
  it('renders a password input and Connect button when open', () => {
    render(<PatModal />);

    expect(screen.getByLabelText('Personal access token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls submitPat with entered PAT when Connect is clicked', async () => {
    const user = userEvent.setup();
    mockSubmitPat.mockResolvedValue(undefined);

    render(<PatModal />);

    await user.type(screen.getByLabelText('Personal access token'), 'ghp_abc123');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(mockSubmitPat).toHaveBeenCalledWith('ghp_abc123');
  });

  it('calls closeModal when Cancel is clicked', async () => {
    const user = userEvent.setup();

    render(<PatModal />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockCloseModal).toHaveBeenCalled();
  });

  it('disables Connect button when input is empty', () => {
    render(<PatModal />);

    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });
});

describe('PatModal — error state', () => {
  it('shows error alert when context has error', () => {
    mockError = 'Bad credentials';

    render(<PatModal />);

    expect(screen.getByText('Bad credentials')).toBeInTheDocument();
  });
});
