import { render, screen, act } from '@testing-library/react';
import { PatProvider, usePatContext } from './PatContext';

function TestConsumer() {
  const { pat, user, setPat, clearPat } = usePatContext();
  return (
    <div>
      <span data-testid="pat">{pat}</span>
      <span data-testid="user">{user ? user.login : 'null'}</span>
      <button
        onClick={() => setPat('ghp_test123', { login: 'twoGiants', avatarUrl: 'https://avatar' })}
      >
        set
      </button>
      <button onClick={clearPat}>clear</button>
    </div>
  );
}

afterEach(() => {
  sessionStorage.clear();
  jest.restoreAllMocks();
});

describe('PatContext', () => {
  it('provides empty pat and null user by default', () => {
    render(
      <PatProvider>
        <TestConsumer />
      </PatProvider>,
    );

    expect(screen.getByTestId('pat').textContent).toBe('');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('stores pat and user when setPat is called', () => {
    render(
      <PatProvider>
        <TestConsumer />
      </PatProvider>,
    );

    act(() => {
      screen.getByText('set').click();
    });

    expect(screen.getByTestId('pat').textContent).toBe('ghp_test123');
    expect(screen.getByTestId('user').textContent).toBe('twoGiants');
  });

  it('persists pat to sessionStorage', () => {
    render(
      <PatProvider>
        <TestConsumer />
      </PatProvider>,
    );

    act(() => {
      screen.getByText('set').click();
    });

    expect(sessionStorage.getItem('ghPat')).toBe('ghp_test123');
    expect(sessionStorage.getItem('ghUser')).toBe(
      JSON.stringify({ login: 'twoGiants', avatarUrl: 'https://avatar' }),
    );
  });

  it('restores pat and user from sessionStorage on mount', () => {
    sessionStorage.setItem('ghPat', 'ghp_restored');
    sessionStorage.setItem(
      'ghUser',
      JSON.stringify({ login: 'restoredUser', avatarUrl: 'https://restored' }),
    );

    render(
      <PatProvider>
        <TestConsumer />
      </PatProvider>,
    );

    expect(screen.getByTestId('pat').textContent).toBe('ghp_restored');
    expect(screen.getByTestId('user').textContent).toBe('restoredUser');
  });

  it('clears pat, user, and sessionStorage when clearPat is called', () => {
    sessionStorage.setItem('ghPat', 'ghp_toRemove');
    sessionStorage.setItem(
      'ghUser',
      JSON.stringify({ login: 'removeMe', avatarUrl: 'https://remove' }),
    );

    render(
      <PatProvider>
        <TestConsumer />
      </PatProvider>,
    );

    act(() => {
      screen.getByText('clear').click();
    });

    expect(screen.getByTestId('pat').textContent).toBe('');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(sessionStorage.getItem('ghPat')).toBeNull();
    expect(sessionStorage.getItem('ghUser')).toBeNull();
  });
});
