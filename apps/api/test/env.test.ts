import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'b',
  S3_ACCESS_KEY: 'k',
  S3_SECRET_KEY: 'super-secret-value',
  JWT_ACCESS_SECRET: 'test-only-jwt-secret-0123456789-abcdef',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('names invalid keys but never echoes values', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'not a url', S3_SECRET_KEY: '' })).toThrow(
      /DATABASE_URL.*S3_SECRET_KEY/,
    );
    try {
      parseEnv({ ...valid, REDIS_URL: 'super-secret-value' });
    } catch (e) {
      expect((e as Error).message).not.toContain('super-secret-value');
    }
  });

  it('refuses the console mailer in production (it would log reset/invite links)', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production', MAIL_TRANSPORT: 'console' })).toThrow(
      /MAIL_TRANSPORT/,
    );
    expect(
      parseEnv({ ...valid, NODE_ENV: 'production', MAIL_TRANSPORT: 'disabled' }).TRUST_PROXY,
    ).toBe(0);
  });
});
