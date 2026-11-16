import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const SYSTEM_QUEUE = 'system';

export type SystemJob = { at: string };

export function systemQueue(connection: Redis) {
  return new Queue<SystemJob>(SYSTEM_QUEUE, { connection });
}
