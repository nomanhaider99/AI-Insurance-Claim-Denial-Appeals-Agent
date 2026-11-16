import { logger } from '../logger.js';

export type Mail = { to: string; subject: string; text: string; link?: string };
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Dev stub: logs the email instead of sending it. Links carry live reset/invite tokens,
 * so this transport is refused when NODE_ENV=production (see env.ts) and the link is
 * logged under `devOnlyLink`, a key that exists nowhere else. Replace with a real provider
 * before production; MAIL_TRANSPORT=disabled drops mail.
 */
export function createMailer(transport: 'console' | 'disabled'): Mailer {
  return {
    async send(mail) {
      if (transport === 'disabled') return;
      logger.info({ subject: mail.subject, devOnlyLink: mail.link }, 'email (dev stub)');
    },
  };
}
