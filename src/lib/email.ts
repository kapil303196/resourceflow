import nodemailer, { Transporter } from "nodemailer";
import { SESClient, SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses";
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
 * Build a "DisplayName <verified@example.com>" From header. SES requires
 * the email-address part to be a verified sender — only the display name
 * varies per tenant.
 */
export function buildSender(displayName?: string): string {
  const verified = fromAddress();
  if (!displayName) return verified;
  // Extract bare email if the verified value already has a display name
  const m = verified.match(/<([^>]+)>/);
  const bare = m ? m[1] : verified;
  // Sanitise display name (no quotes that would break the header)
  const safeName = displayName.replace(/[\\"<>]/g, "");
  return `"${safeName}" <${bare}>`;
}

/**
 * Construct a multipart MIME message for SES SendRawEmail.
 * Supports text + html alternative parts and arbitrary attachments.
 */
function buildRawMime(opts: {
  from: string;
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}): Buffer {
  const mixed = `mixed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const alt = `alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [];

  lines.push(`From: ${opts.from}`);
  lines.push(`To: ${opts.to.join(", ")}`);
  if (opts.cc?.length) lines.push(`Cc: ${opts.cc.join(", ")}`);
  if (opts.replyTo) lines.push(`Reply-To: ${opts.replyTo}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${mixed}"`);
  lines.push("");

  // alternative part (text + html)
  lines.push(`--${mixed}`);
  lines.push(`Content-Type: multipart/alternative; boundary="${alt}"`);
  lines.push("");

  lines.push(`--${alt}`);
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(opts.text);
  lines.push("");

  lines.push(`--${alt}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(opts.html);
  lines.push("");

  lines.push(`--${alt}--`);
  lines.push("");

  for (const att of opts.attachments) {
    const b64 = att.content.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
    const safeName = att.filename.replace(/[\\"]/g, "");
    lines.push(`--${mixed}`);
    lines.push(`Content-Type: ${att.contentType}; name="${safeName}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${safeName}"`);
    lines.push("");
    lines.push(b64);
    lines.push("");
  }

  lines.push(`--${mixed}--`);
  lines.push("");
  return Buffer.from(lines.join("\r\n"), "utf-8");
}

/**
 * Sends transactional email. Prefers Amazon SES when configured;
 * falls back to SMTP/Nodemailer; otherwise no-ops with a warning so
 * dev environments without SMTP/SES configured still work.
 */
export async function sendEmail(opts: {
  to: string | string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  /** Override the default From — usually `buildSender(tenant.name)`. */
  from?: string;
}) {
  const text = opts.text ?? opts.html.replace(/<[^>]+>/g, "");
  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
  const from = opts.from ?? fromAddress();

  const ses = sesClient();
  const hasAttachments = !!opts.attachments?.length;

  if (ses) {
    try {
      if (hasAttachments) {
        // Use SendRawEmail for attachments
        const raw = buildRawMime({
          from,
          to: toList,
          cc: opts.cc,
          replyTo: opts.replyTo,
          subject: opts.subject,
          text,
          html: opts.html,
          attachments: opts.attachments!,
        });
        const out = await ses.send(
          new SendRawEmailCommand({ RawMessage: { Data: raw } }),
        );
        return { skipped: false as const, backend: "ses-raw" as const, messageId: out.MessageId };
      }
      const out = await ses.send(
        new SendEmailCommand({
          Source: from,
          Destination: { ToAddresses: toList, CcAddresses: opts.cc },
          ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
          Message: {
            Subject: { Data: opts.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: opts.html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        }),
      );
      return { skipped: false as const, backend: "ses" as const, messageId: out.MessageId };
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[email] SES send failed:", e?.message);
      // Fall through to SMTP
    }
  }

  const t = smtpTransporter();
  if (t) {
    const info = await t.sendMail({
      from,
      to: toList.join(","),
      cc: opts.cc?.join(","),
      replyTo: opts.replyTo,
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
