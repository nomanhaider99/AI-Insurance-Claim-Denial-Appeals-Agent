import type { Env } from './env.js';

/** The subset of env the HTTP app needs. Tests build this directly. */
export type AppConfig = {
  webOrigin: string;
  appUrl: string;
  jwtAccessSecret: string;
  cookieSecure: boolean;
  trustProxy: number;
};

export function appConfig(env: Env): AppConfig {
  return {
    webOrigin: env.WEB_ORIGIN,
    appUrl: env.APP_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    cookieSecure: env.COOKIE_SECURE,
    trustProxy: env.TRUST_PROXY,
  };
}
