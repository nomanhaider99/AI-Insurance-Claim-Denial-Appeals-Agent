import { pino } from 'pino';

/**
 * Redact credentials and anything that could carry PHI.
 * Add new sensitive field names here (see .claude/skills/phi-security).
 */
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  // Reset/invite pages carry ?token=... in their URL; the browser sends it as Referer.
  'req.headers.referer',
  'res.headers["set-cookie"]',
  '*.link',
  '*.email',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.patientName',
  '*.patientDob',
  '*.memberId',
  '*.ssn',
  '*.extractedText',
];

/**
 * Query strings never reach the logs: pino-http logs `req.url`, and reset/invite links
 * or future search params could carry secrets or PHI. Path only.
 */
export const reqSerializer = (req: { method?: string; url?: string; id?: unknown }) => ({
  id: req.id,
  method: req.method,
  url: req.url?.split('?')[0],
});

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
});
