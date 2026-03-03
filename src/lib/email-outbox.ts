import "server-only";
import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { sendOtpEmail } from "@/lib/email";

const MAX_RETRIES = 5;

type OtpPayload = {
  code: string;
  firstName: string;
};

function isOtpPayload(payload: unknown): payload is OtpPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return typeof value.code === "string" && typeof value.firstName === "string";
}

export async function processPendingEmailOutbox(limit = 25): Promise<number> {
  const pendingRows = await db.query.emailOutbox.findMany({
    where: and(eq(emailOutbox.status, "pending"), lt(emailOutbox.attempts, MAX_RETRIES)),
    orderBy: [asc(emailOutbox.createdAt)],
    limit,
  });

  let processed = 0;

  for (const row of pendingRows) {
    try {
      if (row.kind === "otp_verification" && isOtpPayload(row.payload)) {
        await sendOtpEmail(row.recipientEmail, row.payload.code, row.payload.firstName);
      } else {
        throw new Error("Unsupported outbox payload");
      }

      await db
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, row.id));
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process outbox email";
      await db
        .update(emailOutbox)
        .set({
          status: row.attempts + 1 >= MAX_RETRIES ? "failed" : "pending",
          attempts: row.attempts + 1,
          lastError: message,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, row.id));
    }
  }

  return processed;
}
