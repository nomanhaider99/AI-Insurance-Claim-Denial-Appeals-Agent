const BASE = 'http://same-origin.invalid';

/**
 * Only allow same-origin redirects after login. Parses with the URL parser (which strips
 * tabs/newlines and treats backslashes like slashes) instead of string checks, so inputs
 * like "/\t/evil.com", "//evil.com" or "/\\evil.com" can't escape to another origin.
 */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/')) return '/';
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
