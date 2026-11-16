import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@appeal/shared';
import { AppError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  } else if (isUniqueViolation(err)) {
    // e.g. two concurrent registrations with the same email.
    status = 409;
    body = { error: { code: 'CONFLICT', message: 'This already exists' } };
  } else if (isBodyParseError(err)) {
    status = 400;
    body = { error: { code: 'VALIDATION_ERROR', message: 'Malformed request body' } };
  }

  if (status >= 500) req.log?.error({ err }, 'unhandled error');
  res.status(status).json(body);
};

/** Postgres 23505, possibly wrapped by Drizzle (DrizzleQueryError.cause). */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 3; depth++) {
    if (typeof e === 'object' && 'code' in e && e.code === '23505') return true;
    e = typeof e === 'object' && 'cause' in e ? e.cause : undefined;
  }
  return false;
}

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}
