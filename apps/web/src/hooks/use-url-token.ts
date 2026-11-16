'use client';

import { useEffect, useState } from 'react';

/**
 * Reads a one-time `?token=` from the URL after mount, then removes it from the address
 * bar so it doesn't linger in history, screenshots or Referer headers. These pages also
 * send `Referrer-Policy: no-referrer` (next.config.ts).
 *
 * Returns `undefined` until mounted, then the token ('' if there was none).
 */
export function useUrlToken(): string | undefined {
  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get('token') ?? '';
    if (value) {
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    // Reading browser-only state after mount; runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(value);
  }, []);
  return token;
}
