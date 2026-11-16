import type { Request, Response } from 'express';
import type { AppConfig } from '../../config.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  setCsrfCookie,
} from '../../lib/cookies.js';
import { randomToken } from '../../lib/tokens.js';
import { authOf } from '../../middleware/auth.js';
import type { AuthService } from './auth.service.js';

const refreshCookie = (req: Request): string | undefined => {
  const v: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof v === 'string' ? v : undefined;
};

export function authController(service: AuthService, config: AppConfig) {
  const ctx = (req: Request) => ({ ip: req.ip });

  return {
    csrf(_req: Request, res: Response) {
      const csrfToken = randomToken();
      setCsrfCookie(res, csrfToken, config.cookieSecure);
      res.json({ csrfToken });
    },

    async register(req: Request, res: Response) {
      const { tokens, me } = await service.register(req.body, ctx(req));
      setAuthCookies(res, tokens, config.cookieSecure);
      res.status(201).json(me);
    },

    async login(req: Request, res: Response) {
      const { tokens, me } = await service.login(req.body, ctx(req));
      setAuthCookies(res, tokens, config.cookieSecure);
      res.json(me);
    },

    async refresh(req: Request, res: Response) {
      try {
        const tokens = await service.refresh(refreshCookie(req), ctx(req));
        setAuthCookies(res, tokens, config.cookieSecure);
        res.json({ ok: true });
      } catch (err) {
        clearAuthCookies(res, config.cookieSecure);
        throw err;
      }
    },

    async logout(req: Request, res: Response) {
      await service.logout(refreshCookie(req));
      clearAuthCookies(res, config.cookieSecure);
      res.status(204).end();
    },

    async me(req: Request, res: Response) {
      res.json(await service.me(authOf(req)));
    },

    async forgotPassword(req: Request, res: Response) {
      await service.forgotPassword(req.body, ctx(req));
      res.json({ ok: true });
    },

    async resetPassword(req: Request, res: Response) {
      await service.resetPassword(req.body, ctx(req));
      res.json({ ok: true });
    },

    async acceptInvite(req: Request, res: Response) {
      const { tokens, me } = await service.acceptInvite(req.body, ctx(req));
      setAuthCookies(res, tokens, config.cookieSecure);
      res.status(201).json(me);
    },
  };
}
