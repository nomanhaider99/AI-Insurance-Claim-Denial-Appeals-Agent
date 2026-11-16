import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { roleSchema, type Role } from '@appeal/shared';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ISSUER = 'appeal-api';
const AUDIENCE = 'appeal-web';

export type AuthContext = { userId: string; orgId: string; role: Role };
export type AccessClaims = AuthContext & { sessionVersion: number };

const claimsSchema = z.object({
  sub: z.uuid(),
  org: z.uuid(),
  role: roleSchema,
  sv: z.number().int(),
});

const key = (secret: string) => new TextEncoder().encode(secret);

export function signAccessToken(ctx: AccessClaims, secret: string): Promise<string> {
  return new SignJWT({ org: ctx.orgId, role: ctx.role, sv: ctx.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ctx.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key(secret));
}

/** Returns the auth context, or null for any invalid/expired/tampered token. */
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const claims = claimsSchema.parse(payload);
    return {
      userId: claims.sub,
      orgId: claims.org,
      role: claims.role,
      sessionVersion: claims.sv,
    };
  } catch {
    return null;
  }
}

/** 256-bit random token, URL-safe. Only its hash is stored. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
