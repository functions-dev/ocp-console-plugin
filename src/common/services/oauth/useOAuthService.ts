import { OAuthService } from './OAuthService';

const instance = new OAuthService();

export function useOAuthService(): OAuthService {
  return instance;
}
