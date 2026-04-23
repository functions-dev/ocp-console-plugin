import { render, screen, act } from '@testing-library/react';
import { PatModal } from './PatModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSubmitPat = jest.fn();
const mockClearError = jest.fn();
let mockValidating = false;
let mockError: string | null = null;

jest.mock('../hooks/useUserAvatar', () => ({
  useUserAvatar: () => ({
    submitPat: mockSubmitPat,
    validating: mockValidating,
    error: mockError,
    clearError: mockClearError,
  }),
}));

afterEach(() => {
  mockValidating = false;
  mockError = null;
  jest.clearAllMocks();
});

describe('PatModal', () => {
  it('renders input and Connect button when open', () => {
    render(<PatModal isOpen onClose={jest.fn()} />);

    expect(screen.getByLabelText('Personal access token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<PatModal isOpen={false} onClose={jest.fn()} />);

    expect(screen.queryByLabelText('Personal access token')).not.toBeInTheDocument();
  });

  it('Connect button disabled when input is empty', () => {
    render(<PatModal isOpen onClose={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('calls submitPat with entered token on Connect click', async () => {
    mockSubmitPat.mockResolvedValue(false);

    render(<PatModal isOpen onClose={jest.fn()} />);

    const input = screen.getByLabelText('Personal access token');
    await act(async () => {
      fireInputChange(input, 'ghp_mytoken');
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Connect' }).click();
    });

    expect(mockSubmitPat).toHaveBeenCalledWith('ghp_mytoken');
  });

  it('calls onClose on successful submitPat', async () => {
    mockSubmitPat.mockResolvedValue(true);
    const onClose = jest.fn();

    render(<PatModal isOpen onClose={onClose} />);

    const input = screen.getByLabelText('Personal access token');
    await act(async () => {
      fireInputChange(input, 'ghp_valid');
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Connect' }).click();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows error alert when validation fails', () => {
    mockError = 'Bad credentials';

    render(<PatModal isOpen onClose={jest.fn()} />);

    expect(screen.getByText('Bad credentials')).toBeInTheDocument();
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = jest.fn();

    render(<PatModal isOpen onClose={onClose} />);

    screen.getByRole('button', { name: 'Cancel' }).click();

    expect(onClose).toHaveBeenCalled();
  });
});

function fireInputChange(input: HTMLElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
