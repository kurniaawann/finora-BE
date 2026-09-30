import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getMailTransporter } from '../config/mailer.js';

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Kirim email. Tanpa SMTP di development, isi email dicatat ke log
 * agar kode OTP tetap bisa dipakai saat uji coba lokal.
 */
export const sendMail = async (input: MailInput): Promise<void> => {
  const transporter = getMailTransporter();

  if (!transporter) {
    if (env.isProduction) {
      logger.error(`SMTP belum dikonfigurasi, email "${input.subject}" tidak terkirim`);
    } else {
      logger.info(`[email dev] ke ${input.to} — ${input.subject}\n${input.text}`);
    }

    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
};

/** Kirim di latar belakang: respons API tidak menunggu SMTP. */
export const sendMailInBackground = (input: MailInput): void => {
  sendMail(input).catch((error) => {
    logger.error(`Gagal mengirim email "${input.subject}"`, error);
  });
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Template email kode OTP yang sederhana dan aman ditampilkan di klien email mana pun. */
export const buildCodeEmail = (params: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  code: string;
  expiresInMinutes: number;
}): MailInput => {
  const text = [
    `Halo ${params.name},`,
    '',
    params.intro,
    '',
    `Kode: ${params.code}`,
    '',
    `Kode berlaku ${params.expiresInMinutes} menit dan hanya bisa dipakai sekali.`,
    'Jangan bagikan kode ini ke siapa pun, termasuk yang mengaku dari Finora.',
    'Abaikan email ini bila kamu tidak merasa memintanya.',
    '',
    'Salam,',
    'Tim Finora',
  ].join('\n');

  const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;color:#0f766e;">Finora</h1>
        <p style="margin:0 0 12px;">Halo ${escapeHtml(params.name)},</p>
        <p style="margin:0 0 20px;">${escapeHtml(params.intro)}</p>
        <p style="margin:0 0 20px;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;">${params.code}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Kode berlaku ${params.expiresInMinutes} menit dan hanya bisa dipakai sekali.</p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Jangan bagikan kode ini ke siapa pun, termasuk yang mengaku dari Finora.</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">Abaikan email ini bila kamu tidak merasa memintanya.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { to: params.to, subject: params.subject, text, html };
};
