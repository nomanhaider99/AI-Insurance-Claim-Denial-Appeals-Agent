import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { healthResponseSchema, okResponseSchema } from '@appeal/shared';
import { ApiError, apiFetch, fieldErrorsOf, resetClientState } from './api-client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Call = { url: string; init: RequestInit };

/** Fake fetch driven by a route table; records every call. */
function fakeFetch(routes: Record<string, (call: Call, n: number) => Response>) {
  const calls: Call[] = [];
  const counts: Record<string, number> = {};
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = `${init.method ?? 'GET'} ${url}`;
    counts[key] = (counts[key] ?? 0) + 1;
    const handler = routes[key];
    if (!handler) throw new TypeError(`no route for ${key}`);
    return handler({ url, init }, counts[key]);
  }) as typeof fetch;
  return { impl, calls };
}

const csrfRoute = { 'GET /api/v1/auth/csrf': () => json(200, { csrfToken: 'tok-1' }) };

beforeEach(() => resetClientState());

describe('apiFetch', () => {
  it('returns schema-validated data', async () => {
    const f = fakeFetch({ 'GET /health': () => json(200, { status: 'ok' }) });
    expect(await apiFetch('/health', healthResponseSchema, { fetchImpl: f.impl })).toEqual({
      status: 'ok',
    });
  });

  it('maps the shared error shape to ApiError', async () => {
    const f = fakeFetch({
      'GET /x': () => json(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    });
    const err = await apiFetch('/x', healthResponseSchema, { fetchImpl: f.impl }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'nope' });
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    const err = await apiFetch('/x', healthResponseSchema, {
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    }).catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('sends the CSRF header on mutations only', async () => {
    const f = fakeFetch({
      ...csrfRoute,
      'POST /api/v1/thing': () => json(200, { ok: true }),
      'GET /api/v1/thing': () => json(200, { ok: true }),
    });
    await apiFetch('/api/v1/thing', okResponseSchema, {
      method: 'POST',
      body: {},
      fetchImpl: f.impl,
    });
    await apiFetch('/api/v1/thing', okResponseSchema, { fetchImpl: f.impl });
    const post = f.calls.find((c) => c.init.method === 'POST')!;
    const get = f.calls
      .filter((c) => c.url === '/api/v1/thing')
      .find((c) => c.init.method === 'GET')!;
    expect((post.init.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok-1');
    expect((get.init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  it('on 401 refreshes once and retries the request', async () => {
    const f = fakeFetch({
      ...csrfRoute,
      'GET /api/v1/org': (_c, n) =>
        n === 1
          ? json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } })
          : json(200, { ok: true }),
      'POST /api/v1/auth/refresh': () => json(200, { ok: true }),
    });
    const onUnauthorized = vi.fn();
    const data = await apiFetch('/api/v1/org', okResponseSchema, {
      fetchImpl: f.impl,
      onUnauthorized,
    });
    expect(data).toEqual({ ok: true });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('when refresh fails, calls onUnauthorized and throws 401', async () => {
    const f = fakeFetch({
      ...csrfRoute,
      'GET /api/v1/org': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
      'POST /api/v1/auth/refresh': () =>
        json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
    });
    const onUnauthorized = vi.fn();
    const err = await apiFetch('/api/v1/org', okResponseSchema, {
      fetchImpl: f.impl,
      onUnauthorized,
    }).catch((e) => e);
    expect(err).toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('a failed login does not trigger a refresh', async () => {
    const f = fakeFetch({
      ...csrfRoute,
      'POST /api/v1/auth/login': () =>
        json(401, { error: { code: 'UNAUTHORIZED', message: 'bad' } }),
    });
    const onUnauthorized = vi.fn();
    await apiFetch('/api/v1/auth/login', z.unknown(), {
      method: 'POST',
      body: {},
      fetchImpl: f.impl,
      onUnauthorized,
    }).catch(() => {});
    expect(f.calls.some((c) => c.url.endsWith('/refresh'))).toBe(false);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('refetches the CSRF token and retries once on a CSRF rejection', async () => {
    let csrfN = 0;
    const f = fakeFetch({
      'GET /api/v1/auth/csrf': () => json(200, { csrfToken: `tok-${++csrfN}` }),
      'POST /api/v1/thing': (c) =>
        (c.init.headers as Record<string, string>)['X-CSRF-Token'] === 'tok-2'
          ? json(200, { ok: true })
          : json(403, { error: { code: 'FORBIDDEN', message: 'x', details: { reason: 'csrf' } } }),
    });
    const data = await apiFetch('/api/v1/thing', okResponseSchema, {
      method: 'POST',
      body: {},
      fetchImpl: f.impl,
    });
    expect(data).toEqual({ ok: true });
  });

  it('fieldErrorsOf maps validation details to fields', () => {
    const e = new ApiError(400, 'VALIDATION_ERROR', 'Invalid', [
      { path: 'email', message: 'Enter a valid email' },
    ]);
    expect(fieldErrorsOf(e)).toEqual({ email: 'Enter a valid email' });
    expect(fieldErrorsOf(new Error('x'))).toEqual({});
  });
});
