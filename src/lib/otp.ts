import "server-only";
import { randomInt } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { otpCodes, users } from "@/db/schema";
import { sendOtpEmail } from "@/lib/email";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HASH_ROUNDS = 10;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$/;

export class OtpError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_code" | "expired_code" | "cooldown"
  ) {
    super(message);
  }
}

export function generateOtp(): string {
  return randomInt(1_000_000).toString().padStart(6, "0");
}

export async function getOtpResendCooldownRemaining(userId: string): Promise<number> {
  const latestOtp = await db.query.otpCodes.findFirst({
    where: eq(otpCodes.userId, userId),
    orderBy: (codes, { desc }) => [desc(codes.createdAt)],
  });

  if (!latestOtp) {
    return 0;
  }

  const remainingMs = latestOtp.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

export async function createOtpForUser(
  userId: string,
  email: string,
  firstName: string,
  enforceCooldown = false
): Promise<void> {
  if (enforceCooldown) {
    const remainingSeconds = await getOtpResendCooldownRemaining(userId);
    if (remainingSeconds > 0) {
      throw new OtpError(`Please wait ${remainingSeconds} seconds before requesting a new code`, "cooldown");
    }
  }

  const code = generateOtp();
  const otpHash = await bcrypt.hash(code, OTP_HASH_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await db.transaction(async (tx) => {
    await tx
      .update(otpCodes)
      .set({ used: true })
      .where(and(eq(otpCodes.userId, userId), eq(otpCodes.used, false)));

    await tx.insert(otpCodes).values({
      userId,
      otpHash,
      expiresAt,
    });
  });

  await sendOtpEmail(email, code, firstName);
}

export async function verifyOtp(userId: string, code: string): Promise<void> {
  const normalizedCode = code.trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new OtpError("Invalid verification code", "invalid_code");
  }

  await db.transaction(async (tx) => {
    const otp = await tx.query.otpCodes.findFirst({
      where: and(eq(otpCodes.userId, userId), eq(otpCodes.used, false)),
      orderBy: (codes, { desc }) => [desc(codes.createdAt)],
    });

    if (!otp) {
      throw new OtpError("Invalid verification code", "invalid_code");
    }

    if (!BCRYPT_HASH_PATTERN.test(otp.otpHash)) {
      await tx.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otp.id));
      throw new OtpError("Invalid verification code", "invalid_code");
    }

    const isValid = await bcrypt.compare(normalizedCode, otp.otpHash);
    if (!isValid) {
      throw new OtpError("Invalid verification code", "invalid_code");
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new OtpError("Verification code has expired", "expired_code");
    }

    await tx.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otp.id));

    await tx
      .update(users)
      .set({
        firstLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.firstLoginAt)));
  });
}
