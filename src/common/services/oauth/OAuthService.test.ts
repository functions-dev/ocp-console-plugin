import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { OAuthService, OAuthConfig } from './OAuthService';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  consoleFetchJSON: Object.assign(vi.fn(), {
    post: vi.fn(),
  }),
}));

const enabledConfig: OAuthConfig = { client_id: 'test-client-id', enabled: true };
const disabledConfig: OAuthConfig = { client_id: '', enabled: false };

const STATE_KEY = 'func-console-oauth-state';
const VERIFIER_KEY = 'func-console-oauth-verifier';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

async function waitForSetup(): Promise<void> {
  for (let i = 0; i < 10; i++) await flushMicrotasks();
}

describe('OAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  describe('fetchConfig', () => {
    it('fetches and returns OAuth config from the backend', async () => {
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);

      const service = new OAuthService();
      const result = await service.fetchConfig();

      expect(consoleFetchJSON).toHaveBeenCalledWith(
        '/api/proxy/plugin/console-functions-plugin/backend/api/oauth/config',
      );
      expect(result).toEqual(enabledConfig);
    });

    it('caches the config after the first fetch', async () => {
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);

      const service = new OAuthService();
      await service.fetchConfig();
      await service.fetchConfig();

      expect(consoleFetchJSON).toHaveBeenCalledTimes(1);
    });
  });

  describe('startFlow', () => {
    beforeEach(() => {
      vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new ArrayBuffer(32));
    });

    it('throws when OAuth is not enabled', async () => {
      vi.mocked(consoleFetchJSON).mockResolvedValue(disabledConfig);

      const service = new OAuthService();

      await expect(service.startFlow()).rejects.toThrow('OAuth is not configured on this cluster');
    });

    it('throws when popup is blocked', async () => {
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      vi.spyOn(window, 'open').mockReturnValue(null);

      const service = new OAuthService();

      await expect(service.startFlow()).rejects.toThrow('Popup was blocked by the browser');
      expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
      expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
    });

    it('opens popup with correct OAuth params', async () => {
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      const popup = { closed: true, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      try {
        await service.startFlow();
      } catch {
        // expected - popup is immediately "closed"
      }

      const url = vi.mocked(window.open).mock.calls[0][0] as string;
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=repo');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=');
      expect(url).toContain('code_challenge=');
    });

    it('rejects when popup is closed without completing auth', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();
      flowPromise.catch(() => {});

      await waitForSetup();

      popup.closed = true;
      await vi.advanceTimersByTimeAsync(500);

      await expect(flowPromise).rejects.toThrow('Authorization window was closed');
      expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    });

    it('rejects on oauth-error message', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();
      flowPromise.catch(() => {});

      await waitForSetup();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'oauth-error', error: 'access_denied' },
        }),
      );

      await expect(flowPromise).rejects.toThrow('access_denied');
      expect(popup.close).toHaveBeenCalled();
      expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    });

    it('rejects on state mismatch', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();
      flowPromise.catch(() => {});

      await waitForSetup();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'oauth-callback', code: 'test-code', state: 'wrong-state' },
        }),
      );

      await expect(flowPromise).rejects.toThrow('State mismatch');
    });

    it('exchanges code for token and resolves with access_token', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      vi.mocked(consoleFetchJSON.post).mockResolvedValue({ access_token: 'gho_abc123' });
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();

      await waitForSetup();

      const storedState = sessionStorage.getItem(STATE_KEY)!;
      const storedVerifier = sessionStorage.getItem(VERIFIER_KEY)!;
      expect(storedState).toBeTruthy();
      expect(storedVerifier).toBeTruthy();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'oauth-callback', code: 'auth-code', state: storedState },
        }),
      );

      await vi.advanceTimersByTimeAsync(0);

      const token = await flowPromise;

      expect(token).toBe('gho_abc123');
      expect(consoleFetchJSON.post).toHaveBeenCalledWith(
        '/api/proxy/plugin/console-functions-plugin/backend/api/oauth/callback',
        { code: 'auth-code', code_verifier: storedVerifier },
      );
      expect(popup.close).toHaveBeenCalled();
      expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
      expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
    });

    it('rejects when token exchange fails', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      vi.mocked(consoleFetchJSON.post).mockRejectedValue(new Error('exchange failed'));
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();
      flowPromise.catch(() => {});

      await waitForSetup();

      const storedState = sessionStorage.getItem(STATE_KEY)!;

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'oauth-callback', code: 'auth-code', state: storedState },
        }),
      );

      await vi.advanceTimersByTimeAsync(0);

      await expect(flowPromise).rejects.toThrow('exchange failed');
      expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    });

    it('ignores messages from different origins', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();
      flowPromise.catch(() => {});

      await waitForSetup();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.com',
          data: { type: 'oauth-callback', code: 'stolen-code', state: 'x' },
        }),
      );

      popup.closed = true;
      await vi.advanceTimersByTimeAsync(500);

      await expect(flowPromise).rejects.toThrow('Authorization window was closed');
      expect(consoleFetchJSON.post).not.toHaveBeenCalled();
    });

    it('ignores messages with non-oauth type', async () => {
      vi.useFakeTimers();
      vi.mocked(consoleFetchJSON).mockResolvedValue(enabledConfig);
      const popup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const service = new OAuthService();
      const flowPromise = service.startFlow();
      flowPromise.catch(() => {});

      await waitForSetup();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'unrelated-message' },
        }),
      );

      popup.closed = true;
      await vi.advanceTimersByTimeAsync(500);

      await expect(flowPromise).rejects.toThrow('Authorization window was closed');
      expect(consoleFetchJSON.post).not.toHaveBeenCalled();
    });
  });
});
