import { NextResponse } from "next/server";
import { db } from "@/db";
import { getSession, resolveUserRole } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allUsers = await db.query.users.findMany({
      columns: { id: true, firstName: true, lastName: true, email: true, role: true },
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
