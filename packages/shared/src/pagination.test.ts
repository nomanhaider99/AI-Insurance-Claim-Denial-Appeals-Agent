import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from './pagination.js';

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
  it('coerces strings and caps pageSize', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(() => paginationQuerySchema.parse({ pageSize: '500' })).toThrow();
  });
});
