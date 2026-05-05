import nodemailer, { Transporter } from "nodemailer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "./env";

let _smtp: Transporter | null = null;
let _ses: SESClient | null = null;

function smtpTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (_smtp) return _smtp;
  _smtp = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: false,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return _smtp;
}

function sesClient(): SESClient | null {
  if (!env.AWS_SES_ACCESS_KEY || !env.AWS_SES_SECRET_KEY) return null;
  if (_ses) return _ses;
  _ses = new SESClient({
    region: env.AWS_SES_REGION ?? "ap-south-1",
    credentials: {
      accessKeyId: env.AWS_SES_ACCESS_KEY,
      secretAccessKey: env.AWS_SES_SECRET_KEY,
    },
  });
  return _ses;
}

function fromAddress(): string {
  return env.EMAIL_FROM ?? env.SMTP_FROM ?? "ResourceFlow <no-reply@resourceflow.app>";
}

/**
 * Sends transactional email. Prefers Amazon SES when configured;
 * falls back to SMTP/Nodemailer; otherwise no-ops with a warning so
 * dev environments without SMTP/SES configured still work.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}) {
  const text = opts.text ?? opts.html.replace(/<[^>]+>/g, "");
  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];

  const ses = sesClient();
  if (ses && (!opts.attachments || opts.attachments.length === 0)) {
    // Plain SES SendEmail (no attachments). For attachments, fall through to SMTP.
    const cmd = new SendEmailCommand({
      Source: fromAddress(),
      Destination: { ToAddresses: toList },
      Message: {
        Subject: { Data: opts.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: opts.html, Charset: "UTF-8" },
          Text: { Data: text, Charset: "UTF-8" },
        },
      },
    });
    try {
      const out = await ses.send(cmd);
      return { skipped: false as const, backend: "ses" as const, messageId: out.MessageId };
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[email] SES send failed:", e?.message);
      // Fall through to SMTP if available
    }
  }

  const t = smtpTransporter();
  if (t) {
    const info = await t.sendMail({
      from: fromAddress(),
      to: toList.join(","),
      subject: opts.subject,
      text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { skipped: false as const, backend: "smtp" as const, messageId: info.messageId };
  }

  // eslint-disable-next-line no-console
  console.warn("[email] Neither SES nor SMTP configured — skipping send to", toList);
  return { skipped: true as const, backend: "none" as const };
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
      .map((a) => `<tr><td>${a.severity}</td><td>${a.title}</td><td>${a.entity}</td></tr>`)
      .join("");
    return {
      subject: `Your ResourceFlow alert digest (${alerts.length})`,
      html: `<p>Hi ${name},</p><p>Here's your alert digest:</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Severity</th><th>Alert</th><th>Entity</th></tr></thead><tbody>${rows}</tbody></table>`,
    };
  },
};
