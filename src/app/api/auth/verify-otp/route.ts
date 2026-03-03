import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, resolveUserRole, setSessionCookie } from "@/lib/auth";
import { OtpError, verifyOtp } from "@/lib/otp";

export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json();

    if (!userId || !code) {
      return NextResponse.json(
        { error: "User ID and verification code are required" },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.firstLoginAt)),
    });

    if (!user) {
      return NextResponse.json({ error: "Verification session not found" }, { status: 404 });
    }

    await verifyOtp(userId, code);

    const role = await resolveUserRole(user.id, user.role);
    const token = await createSession(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role,
        department: user.department,
      },
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "OTP verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
