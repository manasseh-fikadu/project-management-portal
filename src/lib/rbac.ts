import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import type { ProfileRole, SessionUser } from "@/lib/auth";
import { db, projectDonors, projectMembers, projects, proposals, tasks } from "@/db";

const EDIT_ROLES: ReadonlySet<ProfileRole> = new Set(["admin", "project_manager"]);

export function canEditData(role: ProfileRole): boolean {
  return EDIT_ROLES.has(role);
}

export function ensureEditAccess(user: SessionUser | null | undefined): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEditData(user.role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role permissions" }, { status: 403 });
  }

  return null;
}

export async function getAccessibleProjectIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "admin") {
    return null;
  }

  const [managedProjects, memberProjects, assignedTaskProjects] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projects.managerId, user.id),
      columns: { id: true },
    }),
    db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, user.id),
      columns: { projectId: true },
    }),
    db.query.tasks.findMany({
      where: eq(tasks.assignedTo, user.id),
      columns: { projectId: true },
    }),
  ]);

  return Array.from(new Set([
    ...managedProjects.map((project) => project.id),
    ...memberProjects.map((membership) => membership.projectId),
    ...assignedTaskProjects.map((task) => task.projectId),
  ]));
}

export async function canAccessProject(user: SessionUser, projectId: string): Promise<boolean> {
  const accessibleProjectIds = await getAccessibleProjectIds(user);
  return accessibleProjectIds === null || accessibleProjectIds.includes(projectId);
}

export async function canAccessTask(user: SessionUser, taskId: string): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { projectId: true },
  });

  if (!task) {
    return false;
  }

  return canAccessProject(user, task.projectId);
}

export async function getAccessibleProposalIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "admin") {
    return null;
  }

  const accessibleProjectIds = await getAccessibleProjectIds(user);
  const [projectProposalRows, ownProposalRows] = await Promise.all([
    accessibleProjectIds && accessibleProjectIds.length > 0
      ? db.query.proposals.findMany({
          where: inArray(proposals.projectId, accessibleProjectIds),
          columns: { id: true },
        })
      : Promise.resolve([]),
    db.query.proposals.findMany({
      where: eq(proposals.createdBy, user.id),
      columns: { id: true },
    }),
  ]);

  return Array.from(new Set([
    ...projectProposalRows.map((proposal) => proposal.id),
    ...ownProposalRows.map((proposal) => proposal.id),
  ]));
}

export async function canAccessProposal(user: SessionUser, proposalId: string): Promise<boolean> {
  const accessibleProposalIds = await getAccessibleProposalIds(user);
  return accessibleProposalIds === null || accessibleProposalIds.includes(proposalId);
}

export async function getAccessibleDonorIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "admin") {
    return null;
  }

  const accessibleProjectIds = await getAccessibleProjectIds(user);
  const [projectRows, linkedDonors, projectProposalRows, ownProposalRows] = await Promise.all([
    accessibleProjectIds && accessibleProjectIds.length > 0
      ? db.query.projects.findMany({
          where: inArray(projects.id, accessibleProjectIds),
          columns: { donorId: true },
        })
      : Promise.resolve([]),
    accessibleProjectIds && accessibleProjectIds.length > 0
      ? db.query.projectDonors.findMany({
          where: inArray(projectDonors.projectId, accessibleProjectIds),
          columns: { donorId: true },
        })
      : Promise.resolve([]),
    accessibleProjectIds && accessibleProjectIds.length > 0
      ? db.query.proposals.findMany({
          where: inArray(proposals.projectId, accessibleProjectIds),
          columns: { donorId: true },
        })
      : Promise.resolve([]),
    db.query.proposals.findMany({
      where: eq(proposals.createdBy, user.id),
      columns: { donorId: true },
    }),
  ]);

  return Array.from(new Set([
    ...projectRows.map((project) => project.donorId).filter((donorId): donorId is string => Boolean(donorId)),
    ...linkedDonors.map((link) => link.donorId),
    ...projectProposalRows.map((proposal) => proposal.donorId).filter((donorId): donorId is string => Boolean(donorId)),
    ...ownProposalRows.map((proposal) => proposal.donorId).filter((donorId): donorId is string => Boolean(donorId)),
  ]));
}

export async function canAccessDonor(user: SessionUser, donorId: string): Promise<boolean> {
  const accessibleDonorIds = await getAccessibleDonorIds(user);
  return accessibleDonorIds === null || accessibleDonorIds.includes(donorId);
}
