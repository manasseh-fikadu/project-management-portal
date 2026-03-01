import "server-only";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }

  return resendClient;
}

export async function sendOtpEmail(to: string, code: string, firstName: string): Promise<void> {
  const resend = getResendClient();

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

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error("Failed to send verification code");
  }
}
