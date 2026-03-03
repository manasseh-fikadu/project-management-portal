import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, milestones, proposals, notifications, projects, users } from "@/db/schema";
import { and, eq, gt, lt, lte, ne, sql, inArray } from "drizzle-orm";
import { createNotification, getAdminUserIds } from "@/lib/notifications";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/notifications
 * 
 * Protected by CRON_SECRET. Scans for:
 * 1. Tasks with due dates within the next 3 days (not completed)
 * 2. Milestones with due dates within the next 3 days (not completed)
 * 3. Proposals pending review for more than 7 days
 * 
 * Deduplicates against recent notifications to avoid spamming.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: check cron secret
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!CRON_SECRET || token !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent notification entity IDs to avoid duplicates (last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentNotifs = await db
      .select({ entityId: notifications.entityId, entityType: notifications.entityType, userId: notifications.userId })
      .from(notifications)
      .where(gt(notifications.createdAt, oneDayAgo));

    const recentSet = new Set(recentNotifs.map((n) => `${n.entityType}:${n.entityId}`));
    const recentUserSet = new Set(recentNotifs.map((n) => `${n.entityType}:${n.entityId}:${n.userId}`));
    let created = 0;

    // 1. Tasks approaching deadline
    const upcomingTasks = await db.query.tasks.findMany({
      where: and(
        ne(tasks.status, "completed"),
        gt(tasks.dueDate, now),
        lte(tasks.dueDate, threeDaysFromNow),
      ),
      with: {
        project: { columns: { name: true } },
        assignee: { columns: { id: true, firstName: true } },
      },
    });

    for (const task of upcomingTasks) {
      if (recentSet.has(`task:${task.id}`)) continue;
      if (!task.assignedTo) continue;

      await createNotification({
        userId: task.assignedTo,
        type: "deadline_approaching",
        title: "Task deadline approaching",
        message: `"${task.title}" in project "${task.project?.name ?? "Unknown"}" is due on ${task.dueDate?.toLocaleDateString()}.`,
        entityType: "task",
        entityId: task.id,
        sendEmail: true,
      });
      created++;
    }

    // Overdue tasks
    const overdueTasks = await db.query.tasks.findMany({
      where: and(
        ne(tasks.status, "completed"),
        lt(tasks.dueDate, now),
      ),
      with: {
        project: { columns: { name: true } },
      },
    });

    for (const task of overdueTasks) {
      if (recentSet.has(`task:${task.id}`)) continue;
      if (!task.assignedTo) continue;

      await createNotification({
        userId: task.assignedTo,
        type: "deadline_overdue",
        title: "Task is overdue",
        message: `"${task.title}" in project "${task.project?.name ?? "Unknown"}" was due on ${task.dueDate?.toLocaleDateString()}.`,
        entityType: "task",
        entityId: task.id,
        sendEmail: true,
      });
      created++;
    }

    // 2. Milestones approaching deadline
    const upcomingMilestones = await db.query.milestones.findMany({
      where: and(
        ne(milestones.status, "completed"),
        ne(milestones.status, "cancelled"),
        gt(milestones.dueDate, now),
        lte(milestones.dueDate, threeDaysFromNow),
      ),
      with: {
        project: {
          columns: { name: true, managerId: true },
        },
      },
    });

    for (const ms of upcomingMilestones) {
      if (recentSet.has(`milestone:${ms.id}`)) continue;
      if (!ms.project?.managerId) continue;

      await createNotification({
        userId: ms.project.managerId,
        type: "deadline_approaching",
        title: "Milestone deadline approaching",
        message: `"${ms.title}" in project "${ms.project.name}" is due on ${ms.dueDate?.toLocaleDateString()}.`,
        entityType: "milestone",
        entityId: ms.id,
        sendEmail: true,
      });
      created++;
    }

    // Overdue milestones
    const overdueMilestones = await db.query.milestones.findMany({
      where: and(
        ne(milestones.status, "completed"),
        ne(milestones.status, "cancelled"),
        lt(milestones.dueDate, now),
      ),
      with: {
        project: {
          columns: { name: true, managerId: true },
        },
      },
    });

    for (const ms of overdueMilestones) {
      if (recentSet.has(`milestone:${ms.id}`)) continue;
      if (!ms.project?.managerId) continue;

      await createNotification({
        userId: ms.project.managerId,
        type: "deadline_overdue",
        title: "Milestone is overdue",
        message: `"${ms.title}" in project "${ms.project.name}" was due on ${ms.dueDate?.toLocaleDateString()}.`,
        entityType: "milestone",
        entityId: ms.id,
        sendEmail: true,
      });
      created++;
    }

    // 3. Proposals pending approval for > 7 days
    const pendingProposals = await db.query.proposals.findMany({
      where: and(
        inArray(proposals.status, ["submitted", "under_review"]),
        lt(proposals.updatedAt, sevenDaysAgo),
      ),
      columns: { id: true, title: true, createdBy: true, status: true },
    });

    const adminIds = await getAdminUserIds();

    for (const proposal of pendingProposals) {
      // Notify admins about pending approval (dedupe per admin)
      for (const adminId of adminIds) {
        if (recentUserSet.has(`proposal:${proposal.id}:${adminId}`)) continue;

        await createNotification({
          userId: adminId,
          type: "approval_pending",
          title: "Proposal awaiting review",
          message: `"${proposal.title}" has been ${proposal.status.replace("_", " ")} for more than 7 days.`,
          entityType: "proposal",
          entityId: proposal.id,
          sendEmail: true,
        });
        created++;
      }
    }

    return NextResponse.json({ success: true, notificationsCreated: created });
  } catch (error) {
    console.error("Error in cron notification scanner:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
