import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

const PROXY_BASE = '/api/proxy/plugin/console-functions-plugin/backend';
const STATE_KEY = 'func-console-oauth-state';
const VERIFIER_KEY = 'func-console-oauth-verifier';

export interface OAuthConfig {
  client_id: string;
  enabled: boolean;
}

interface OAuthMessage {
  type: 'oauth-callback' | 'oauth-error';
  code?: string;
  state?: string;
  error?: string;
}

export class OAuthService {
  #configCache: OAuthConfig | null = null;

  async fetchConfig(): Promise<OAuthConfig> {
    if (this.#configCache) return this.#configCache;
    this.#configCache = await consoleFetchJSON(`${PROXY_BASE}/api/oauth/config`);
    return this.#configCache!;
  }

  async startFlow(): Promise<string> {
    const config = await this.fetchConfig();
    if (!config.enabled) throw new Error('OAuth is not configured on this cluster');

    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(VERIFIER_KEY, codeVerifier);

    const params = new URLSearchParams({
      client_id: config.client_id,
      redirect_uri: `${window.location.origin}/faas/oauth/callback`,
      scope: 'repo',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const popup = window.open(
      `https://github.com/login/oauth/authorize?${params}`,
      'github-oauth',
      'width=600,height=700',
    );
    if (!popup) {
      cleanup();
      throw new Error('Popup was blocked by the browser. Please allow popups for this site.');
    }

    return new Promise<string>((resolve, reject) => {
      const closedCheck = setInterval(() => {
        if (popup.closed) {
          clearInterval(closedCheck);
          window.removeEventListener('message', onMessage);
          cleanup();
          reject(new Error('Authorization window was closed'));
        }
      }, 500);

      const onMessage = async (event: MessageEvent<OAuthMessage>) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data?.type?.startsWith('oauth-')) return;

        clearInterval(closedCheck);
        window.removeEventListener('message', onMessage);
        popup.close();

        if (event.data.type === 'oauth-error') {
          cleanup();
          reject(new Error(event.data.error ?? 'Authorization denied'));
          return;
        }

        const storedState = sessionStorage.getItem(STATE_KEY);
        if (event.data.state !== storedState) {
          cleanup();
          reject(new Error('State mismatch, possible CSRF attack'));
          return;
        }

        try {
          const storedVerifier = sessionStorage.getItem(VERIFIER_KEY)!;
          const tokenResponse = await consoleFetchJSON.post(`${PROXY_BASE}/api/oauth/callback`, {
            code: event.data.code,
            code_verifier: storedVerifier,
          });
          cleanup();
          resolve(tokenResponse.access_token);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      window.addEventListener('message', onMessage);
    });
  }
}

function cleanup() {
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
}

function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64UrlEncode(bytes.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(digest);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
