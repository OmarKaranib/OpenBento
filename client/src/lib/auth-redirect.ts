const PRODUCTION_ORIGIN = 'https://openbento.tv';

export type AuthRedirectPath = '/auth/callback' | '/auth/reset-password';

export function authRedirectUrl(origin: string | undefined, path: AuthRedirectPath): string {
  try {
    const parsed = new URL(origin || PRODUCTION_ORIGIN);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
      return new URL(path, parsed.origin).toString();
    }
  } catch {
    // Fall through to the production site.
  }
  return new URL(path, PRODUCTION_ORIGIN).toString();
}

export function currentAuthRedirectUrl(path: AuthRedirectPath): string {
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  return authRedirectUrl(origin, path);
}
