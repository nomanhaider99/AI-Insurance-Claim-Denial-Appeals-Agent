import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps relative paths', () => {
    expect(safeNext('/settings/users?x=1#top')).toBe('/settings/users?x=1#top');
  });

  it('rejects open redirects, including parser tricks', () => {
    for (const bad of [
      null,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r\n/evil.example',
      'javascript:alert(1)',
    ]) {
      expect(safeNext(bad)).toBe('/');
    }
  });
});
