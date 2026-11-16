import { env } from './env.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import { createClients } from './lib/clients.js';
import { systemQueue } from './jobs/queues.js';

const config = env();
const clients = createClients(config);
const app = createApp({ healthChecks: clients.healthChecks, webOrigin: config.WEB_ORIGIN });

const server = app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT }, 'api listening');
});

// Proves API -> queue -> worker wiring on boot.
const queue = systemQueue(clients.redis);
await queue.add('heartbeat', { at: new Date().toISOString() }, { removeOnComplete: 100 });

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await queue.close();
  await clients.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
