import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import type { Env } from '../env.js';
import { createDb } from '../db/client.js';
import type { HealthChecks } from '../routes/health.js';

/** Wires real infrastructure clients. Tests inject fakes through createApp deps instead. */
export function createClients(env: Env) {
  const { db, pool } = createDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });

  const healthChecks: HealthChecks = {
    database: async () => {
      await db.execute(sql`select 1`);
    },
    redis: async () => {
      await redis.ping();
    },
    storage: async () => {
      await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    },
  };

  const close = async () => {
    await Promise.allSettled([pool.end(), redis.quit()]);
    s3.destroy();
  };

  return { db, redis, s3, healthChecks, close };
}
