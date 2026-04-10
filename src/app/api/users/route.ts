import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { createUser, getSession, resolveUserRole, type ProfileRole } from "@/lib/auth";

const VALID_ROLES: ProfileRole[] = ["admin", "project_manager", "team_member", "donor"];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allUsers = await db.query.users.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });

    const usersWithProfileRoles = await Promise.all(
      allUsers.map(async (user) => ({
        ...user,
        role: await resolveUserRole(user.id, user.role),
      }))
    );

    return NextResponse.json({ users: usersWithProfileRoles });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, firstName, lastName, role, department } = body;

    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, firstName, lastName, role" },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const newUser = await createUser(email, password, firstName, lastName, role, department, {
      mustChangePassword: true,
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role,
        department: newUser.department,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("already exists") ? 409 : 500;
    if (status === 500) console.error("Error creating user:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
