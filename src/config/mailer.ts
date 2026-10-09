import nodemailer, { type Transporter } from 'nodemailer';

import { env } from './env.js';

let transporter: Transporter | null | undefined;

export const isMailConfigured = (): boolean => Boolean(env.smtp.host);

/** Transport SMTP dibuat sekali; null bila SMTP_HOST belum diisi. */
export const getMailTransporter = (): Transporter | null => {
  if (transporter !== undefined) {
    return transporter;
  }

  transporter = isMailConfigured()
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: env.smtp.user
          ? { user: env.smtp.user, pass: env.smtp.pass }
          : undefined,
      })
    : null;

  return transporter;
};
