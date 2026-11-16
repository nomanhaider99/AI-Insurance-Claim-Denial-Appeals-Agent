import { apiErrorSchema, type ErrorCode } from '@appeal/shared';
import type { z } from 'zod';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

type Options = Omit<RequestInit, 'body'> & { body?: unknown; fetchImpl?: typeof fetch };

/**
 * Typed fetch wrapper. Always sends cookies, validates the response with `schema`,
 * and turns the API's shared error shape into ApiError.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  { body, fetchImpl = fetch, headers, ...init }: Options = {},
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetchImpl(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(res.status, code as ErrorCode, message, details);
    }
    throw new ApiError(res.status, 'UNKNOWN', `Request failed (${res.status})`);
  }
  return schema.parse(json);
}
