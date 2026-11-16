import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });

export const dependencyStatusSchema = z.enum(['ok', 'error']);
export const readinessResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    database: dependencyStatusSchema,
    redis: dependencyStatusSchema,
    storage: dependencyStatusSchema,
  }),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
