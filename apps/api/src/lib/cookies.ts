import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from './tokens.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
/** Non-secret hint ("1") on path / so the web app's route guard knows a session may exist. */
export const SESSION_HINT_COOKIE = 'has_session';
/** Refresh cookie is only sent to auth routes. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const base = (secure: boolean): CookieOptions => ({ httpOnly: true, secure, sameSite: 'lax' });

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean,
) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(secure),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(secure),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
  res.cookie(SESSION_HINT_COOKIE, '1', {
    ...base(secure),
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_COOKIE_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { ...base(secure), path: '/' });
}

/** Readable by page JS on purpose (double-submit CSRF). Not a secret on its own. */
export function setCsrfCookie(res: Response, token: string, secure: boolean) {
  res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
}
