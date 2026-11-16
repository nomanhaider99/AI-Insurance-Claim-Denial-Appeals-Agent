import { logger } from '../logger.js';

export type Mail = { to: string; subject: string; text: string; link?: string };
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Dev stub: logs the email (including its link) instead of sending it.
 * Replace with a real provider before production; MAIL_TRANSPORT=disabled drops mail.
 */
export function createMailer(transport: 'console' | 'disabled'): Mailer {
  return {
    async send(mail) {
      if (transport === 'disabled') return;
      logger.info(
        { mail: { to: mail.to, subject: mail.subject, link: mail.link } },
        'email (stub)',
      );
    },
  };
}
