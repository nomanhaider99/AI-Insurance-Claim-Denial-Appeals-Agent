import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';
import { SYSTEM_QUEUE, type SystemJob } from './jobs/queues.js';

const config = env();
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<SystemJob>(
  SYSTEM_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'heartbeat processed');
  },
  { connection, concurrency: 5 },
);

worker.on('ready', () => logger.info({ queue: SYSTEM_QUEUE }, 'worker ready'));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'job failed'));

async function shutdown() {
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
