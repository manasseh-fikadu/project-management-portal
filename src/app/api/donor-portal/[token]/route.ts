import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { donorAccessTokens, donors, projectDonors, projects } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== "string" || !/^[0-9a-fA-F]{64}$/.test(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const tokenHash = hashToken(token);

    const accessToken = await db.query.donorAccessTokens.findFirst({
      where: and(
        eq(donorAccessTokens.tokenHash, tokenHash),
        eq(donorAccessTokens.isRevoked, false),
        gt(donorAccessTokens.expiresAt, new Date()),
      ),
      with: {
        donor: true,
      },
    });

    if (!accessToken) {
      return NextResponse.json(
        { error: "Invalid, expired, or revoked access link" },
        { status: 403 }
      );
    }

    // Update last accessed timestamp
    await db
      .update(donorAccessTokens)
      .set({ lastAccessedAt: new Date() })
      .where(eq(donorAccessTokens.id, accessToken.id));

    // Fetch all projects linked to this donor
    const donorProjectLinks = await db.query.projectDonors.findMany({
      where: eq(projectDonors.donorId, accessToken.donorId),
      with: {
        project: {
          with: {
            manager: {
              columns: { id: true, firstName: true, lastName: true },
            },
            milestones: {
              orderBy: (milestones, { asc }) => [asc(milestones.order)],
              columns: {
                id: true,
                title: true,
                description: true,
                status: true,
                dueDate: true,
                completedAt: true,
                order: true,
              },
            },
            tasks: {
              orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
              columns: {
                id: true,
                title: true,
                description: true,
                status: true,
                priority: true,
                progress: true,
                dueDate: true,
                completedAt: true,
                createdAt: true,
              },
              with: {
                assignee: {
                  columns: { id: true, firstName: true, lastName: true },
                },
              },
            },
            documents: {
              columns: {
                id: true,
                name: true,
                type: true,
                url: true,
                size: true,
                createdAt: true,
              },
            },
            members: {
              with: {
                user: {
                  columns: { id: true, firstName: true, lastName: true },
                },
              },
            },
            budgetAllocations: {
              columns: {
                id: true,
                activityName: true,
                plannedAmount: true,
              },
            },
          },
        },
      },
    });

    const projectsData = donorProjectLinks.map((link) => ({
      id: link.project.id,
      name: link.project.name,
      description: link.project.description,
      status: link.project.status,
      totalBudget: link.project.totalBudget,
      spentBudget: link.project.spentBudget,
      startDate: link.project.startDate,
      endDate: link.project.endDate,
      donorStatus: link.status,
      manager: link.project.manager,
      milestones: link.project.milestones,
      tasks: link.project.tasks,
      documents: link.project.documents,
      members: link.project.members,
      budgetAllocations: link.project.budgetAllocations,
    }));

    return NextResponse.json({
      donor: {
        id: accessToken.donor.id,
        name: accessToken.donor.name,
        type: accessToken.donor.type,
      },
      expiresAt: accessToken.expiresAt,
      projects: projectsData,
    });
  } catch (error) {
    console.error("Error fetching donor portal data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
