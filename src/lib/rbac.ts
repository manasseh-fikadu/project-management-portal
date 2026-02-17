import { NextResponse } from "next/server";
import type { ProfileRole, SessionUser } from "@/lib/auth";

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
