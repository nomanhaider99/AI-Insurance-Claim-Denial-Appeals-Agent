import type { AuthContext } from '../lib/tokens.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. The only trusted source of orgId and role. */
      auth?: AuthContext;
    }
  }
}

export {};
