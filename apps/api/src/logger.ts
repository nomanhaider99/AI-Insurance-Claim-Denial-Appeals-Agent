import { pino } from 'pino';

/**
 * Redact credentials and anything that could carry PHI.
 * Add new sensitive field names here (see .claude/skills/phi-security).
 */
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
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

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
});
