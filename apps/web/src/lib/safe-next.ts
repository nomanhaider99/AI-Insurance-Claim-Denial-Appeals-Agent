/** Only allow same-site relative redirects after login (blocks //evil.com, /\evil.com, absolute URLs). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
