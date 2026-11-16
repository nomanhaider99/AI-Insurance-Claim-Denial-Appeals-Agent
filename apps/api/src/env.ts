import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  /** Public URL of the web app, used in emailed links. */
  APP_URL: z.url().default('http://localhost:3000'),
  COOKIE_SECURE: z.stringbool().default(true),
  /** Express "trust proxy" hop count (1 behind the Next.js proxy / ingress). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  MAIL_TRANSPORT: z.enum(['console', 'disabled']).default('console'),
});

export type Env = z.infer<typeof envSchema>;

/** Parses env and throws an error naming only the invalid keys (never their values). */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment variables: ${keys}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
