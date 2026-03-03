import "server-only";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "no-reply@local.test";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 1025);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? (SMTP_HOST ? "smtp" : "resend");

let resendClient: Resend | null = null;
let smtpClient: Transporter | null = null;

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }

  return resendClient;
}

function getSmtpClient(): Transporter {
  if (!SMTP_HOST) {
    throw new Error("SMTP_HOST environment variable is required for SMTP email provider");
  }

  if (!smtpClient) {
    smtpClient = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }

  return smtpClient;
}

export async function sendOtpEmail(to: string, code: string, firstName: string): Promise<void> {
  const subject = "Your verification code";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">Sign-in verification</h2>
      <p style="margin-top: 0;">Hi ${firstName}, use the code below to verify your first sign-in.</p>
      <div style="font-size: 32px; letter-spacing: 10px; font-weight: 700; margin: 24px 0; text-align: center;">
        ${code}
      </div>
      <p style="margin-bottom: 0;">This code expires in 10 minutes.</p>
      <p style="margin-top: 8px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  try {
    if (EMAIL_PROVIDER === "smtp") {
      const smtp = getSmtpClient();
      await smtp.sendMail({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });
      return;
    }

    if (EMAIL_PROVIDER === "resend") {
      const resend = getResendClient();
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });

      if (error) {
        throw new Error("Failed to send verification code");
      }
      return;
    }

    throw new Error(`Unsupported EMAIL_PROVIDER: ${EMAIL_PROVIDER}`);
  } catch (error) {
    throw error;
  }
}
