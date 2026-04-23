import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { FunctionsEmptyState } from './EmptyState';
import { usePatContext } from '../hooks/usePatContext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../hooks/usePatContext', () => ({
  usePatContext: jest.fn().mockReturnValue({ isConnected: false }),
}));

afterEach(() => {
  jest.clearAllMocks();
  (usePatContext as jest.Mock).mockReturnValue({ isConnected: false });
});

describe('FunctionsEmptyState', () => {
  it('renders a heading with "No functions found"', () => {
    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('renders a "Create function" link pointing to /faas/create when connected', () => {
    (usePatContext as jest.Mock).mockReturnValue({ isConnected: true });

    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Create function' });
    expect(link).toHaveAttribute('href', '/faas/create');
  });

  it('disables Create function button when not connected', () => {
    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Create function' })).toBeDisabled();
  });

  it('shows connection hint when not connected', () => {
    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Connect to GitHub using the button in the top-right corner to see your functions.'),
    ).toBeInTheDocument();
  });

  it('shows create prompt when connected', () => {
    (usePatContext as jest.Mock).mockReturnValue({ isConnected: true });

    render(
      <MemoryRouter>
        <FunctionsEmptyState />
      </MemoryRouter>,
    );

    expect(screen.getByText('Create a serverless function to get started.')).toBeInTheDocument();
  });
});
