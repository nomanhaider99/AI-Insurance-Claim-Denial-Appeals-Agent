import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps relative paths', () => {
    expect(safeNext('/settings/users?x=1')).toBe('/settings/users?x=1');
  });

  it('rejects open redirects', () => {
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example']) {
      expect(safeNext(bad)).toBe('/');
    }
  });
});
