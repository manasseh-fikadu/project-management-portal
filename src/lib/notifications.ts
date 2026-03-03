import "server-only";
import { db } from "@/db";
import { notifications, emailOutbox, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type NotificationType =
  | "deadline_approaching"
  | "deadline_overdue"
  | "approval_pending"
  | "approval_decision"
  | "task_assigned"
  | "milestone_updated";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  sendEmail?: boolean;
}): Promise<void> {
  const { userId, type, title, message, entityType, entityId, sendEmail } = params;

  // Insert in-app notification
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
  });

  // Optionally queue an email
  if (sendEmail) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true, firstName: true },
    });

    if (user) {
      await db.insert(emailOutbox).values({
        kind: "notification",
        recipientEmail: user.email,
        payload: {
          firstName: user.firstName,
          title,
          message,
          type,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
        },
      });
    }
  }
}

/**
 * Notify multiple users at once. Useful for broadcasting to admins.
 */
export async function notifyUsers(
  userIds: string[],
  params: Omit<Parameters<typeof createNotification>[0], "userId">,
): Promise<void> {
  for (const userId of userIds) {
    await createNotification({ ...params, userId });
  }
}

/**
 * Fetch all admin user IDs (useful for approval notifications).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await db.query.users.findMany({
    where: eq(users.role, "admin"),
    columns: { id: true },
  });
  return admins.map((a) => a.id);
}
