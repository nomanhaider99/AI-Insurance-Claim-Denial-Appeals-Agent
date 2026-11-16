import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@appeal/shared';
import { ApiError, apiFetch } from './api-client';

const respond = (status: number, body: unknown) => async () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiFetch', () => {
  it('returns schema-validated data', async () => {
    const data = await apiFetch('/health', healthResponseSchema, {
      fetchImpl: respond(200, { status: 'ok' }),
    });
    expect(data).toEqual({ status: 'ok' });
  });

  it('maps the shared error shape to ApiError', async () => {
    const err = await apiFetch('/x', healthResponseSchema, {
      fetchImpl: respond(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'nope' });
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    const err = await apiFetch('/x', healthResponseSchema, {
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
