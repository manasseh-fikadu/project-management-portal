import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { sendOtpEmail } from "@/lib/email";

const MAX_RETRIES = 5;

function buildWorkerId(): string {
  return `email-outbox-worker-${process.pid}-${crypto.randomUUID()}`;
}

async function claimPendingRows(workerId: string, limit: number) {
  const result = await db.execute(sql`
    WITH rows_to_claim AS (
      SELECT id
      FROM ${emailOutbox}
      WHERE ${emailOutbox.status} = 'pending'::email_outbox_status
        AND ${emailOutbox.attempts} < ${MAX_RETRIES}
      ORDER BY ${emailOutbox.createdAt}
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE ${emailOutbox}
    SET
      "status" = 'processing'::email_outbox_status,
      "processor_id" = ${workerId},
      "processing_started_at" = NOW(),
      "updated_at" = NOW()
    FROM rows_to_claim
    WHERE ${emailOutbox.id} = rows_to_claim.id
    RETURNING
      ${emailOutbox.id},
      ${emailOutbox.kind},
      ${emailOutbox.recipientEmail} AS "recipientEmail",
      ${emailOutbox.payload}
  `);

  return result.rows as Array<{
    id: string;
    kind: string;
    recipientEmail: string;
    payload: unknown;
  }>;
}

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
  const workerId = buildWorkerId();
  const pendingRows = await claimPendingRows(workerId, limit);

  let processed = 0;

  for (const row of pendingRows) {
    try {
      if (row.kind === "otp_verification" && isOtpPayload(row.payload)) {
        await sendOtpEmail(row.recipientEmail, row.payload.code, row.payload.firstName);
      } else {
        throw new Error("Unsupported outbox payload");
      }

      const finalizedRows = await db
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: new Date(),
          processorId: null,
          processingStartedAt: null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailOutbox.id, row.id),
            eq(emailOutbox.status, "processing"),
            eq(emailOutbox.processorId, workerId),
          ),
        )
        .returning({ id: emailOutbox.id });

      if (finalizedRows.length === 1) {
        processed += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process outbox email";
      await db
        .update(emailOutbox)
        .set({
          status: sql`
            CASE
              WHEN ${emailOutbox.attempts} + 1 >= ${MAX_RETRIES}
              THEN 'failed'::email_outbox_status
              ELSE 'pending'::email_outbox_status
            END
          `,
          attempts: sql`${emailOutbox.attempts} + 1`,
          processorId: null,
          processingStartedAt: null,
          lastError: message,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailOutbox.id, row.id),
            eq(emailOutbox.status, "processing"),
            eq(emailOutbox.processorId, workerId),
          ),
        );
    }
  }

  return processed;
}
