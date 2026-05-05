import nodemailer, { Transporter } from "nodemailer";
import { env } from "./env";

let _transporter: Transporter | null = null;

function transporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: false,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return _transporter;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}) {
  const t = transporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.warn("[email] SMTP not configured — skipping send to", opts.to);
    return { skipped: true } as const;
  }
  const info = await t.sendMail({
    from: env.SMTP_FROM,
    to: Array.isArray(opts.to) ? opts.to.join(",") : opts.to,
    subject: opts.subject,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    html: opts.html,
    attachments: opts.attachments,
  });
  return { skipped: false as const, messageId: info.messageId };
}

export const emailTemplates = {
  invitation(name: string, inviterName: string, link: string, tenantName: string) {
    return {
      subject: `You've been invited to ${tenantName} on ResourceFlow`,
      html: `<p>Hi ${name},</p><p>${inviterName} has invited you to join <strong>${tenantName}</strong> on ResourceFlow.</p><p><a href="${link}">Accept invitation</a></p><p>This link expires in 24 hours.</p>`,
    };
  },
  passwordReset(name: string, link: string) {
    return {
      subject: `Reset your ResourceFlow password`,
      html: `<p>Hi ${name},</p><p>Click below to reset your password (link expires in 1 hour):</p><p><a href="${link}">Reset password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    };
  },
  invoice(invoiceNumber: string, customerName: string, amount: string, dueDate: string, link: string) {
    return {
      subject: `Invoice ${invoiceNumber} from ResourceFlow`,
      html: `<p>Hi ${customerName},</p><p>Please find invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong>, due <strong>${dueDate}</strong>.</p><p><a href="${link}">Download invoice</a></p>`,
    };
  },
  alertDigest(name: string, alerts: { title: string; severity: string; entity: string }[]) {
    const rows = alerts
      .map(
        (a) =>
          `<tr><td>${a.severity}</td><td>${a.title}</td><td>${a.entity}</td></tr>`,
      )
      .join("");
    return {
      subject: `Your ResourceFlow alert digest (${alerts.length})`,
      html: `<p>Hi ${name},</p><p>Here's your alert digest:</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Severity</th><th>Alert</th><th>Entity</th></tr></thead><tbody>${rows}</tbody></table>`,
    };
  },
};
