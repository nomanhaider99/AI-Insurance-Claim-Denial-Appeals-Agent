import { apiErrorSchema, csrfResponseSchema, type ErrorCode } from '@appeal/shared';
import type { z } from 'zod';

/** Empty = same origin; Next.js rewrites /api/* to the API server. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, 'body'> & {
  body?: unknown;
  fetchImpl?: typeof fetch;
  /** Called when the session can't be refreshed. Defaults to redirecting to /login. */
  onUnauthorized?: () => void;
};

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Auth endpoints whose 401 means "bad credentials", not "session expired". */
const NO_REFRESH = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/register'];

let csrfToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

/** Test hook. */
export function resetClientState() {
  csrfToken = null;
  refreshing = null;
}

async function getCsrf(fetchImpl: typeof fetch): Promise<string> {
  if (!csrfToken) {
    const res = await fetchImpl(`${API_URL}/api/v1/auth/csrf`, { credentials: 'include' });
    csrfToken = csrfResponseSchema.parse(await res.json()).csrfToken;
  }
  return csrfToken;
}

/** One refresh at a time; concurrent 401s wait for the same attempt. */
function refreshSession(fetchImpl: typeof fetch): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetchImpl(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': await getCsrf(fetchImpl) },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // Full reload on purpose: drops all cached client state for the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}`);
}

/**
 * Typed fetch wrapper: sends cookies and the CSRF header, validates the response with `schema`,
 * maps the API's error shape to ApiError, and transparently refreshes an expired session once.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  options: Options = {},
): Promise<z.infer<S>> {
  const { body, fetchImpl = fetch, onUnauthorized = redirectToLogin, headers, ...init } = options;
  const method = (init.method ?? 'GET').toUpperCase();

  const send = async (): Promise<Response> => {
    try {
      return await fetchImpl(`${API_URL}${path}`, {
        ...init,
        method,
        credentials: 'include',
        headers: {
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(!SAFE.has(method) && { 'X-CSRF-Token': await getCsrf(fetchImpl) }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
    }
  };

  let res = await send();
  let error = res.ok ? null : await parseError(res);

  if (error?.status === 403 && isCsrfError(error)) {
    csrfToken = null;
    res = await send();
    error = res.ok ? null : await parseError(res);
  }
  if (error?.status === 401 && !NO_REFRESH.includes(path)) {
    if (await refreshSession(fetchImpl)) {
      res = await send();
      error = res.ok ? null : await parseError(res);
    }
    if (error?.status === 401) onUnauthorized();
  }
  if (error) throw error;

  if (res.status === 204) return schema.parse(undefined);
  return schema.parse(await res.json());
}

async function parseError(res: Response): Promise<ApiError> {
  const json: unknown = await res.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(json);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(res.status, code as ErrorCode, message, details);
  }
  return new ApiError(res.status, 'UNKNOWN', `Request failed (${res.status})`);
}

function isCsrfError(e: ApiError) {
  return typeof e.details === 'object' && e.details !== null && 'reason' in e.details
    ? e.details.reason === 'csrf'
    : false;
}

/** Field errors from a VALIDATION_ERROR, keyed by field path. */
export function fieldErrorsOf(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || e.code !== 'VALIDATION_ERROR' || !Array.isArray(e.details)) {
    return {};
  }
  return Object.fromEntries(
    (e.details as { path?: string; message?: string }[])
      .filter((d) => d.path && d.message)
      .map((d) => [d.path!, d.message!]),
  );
}
