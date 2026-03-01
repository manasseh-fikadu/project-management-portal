import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { OtpError, createOtpForUser, getOtpResendCooldownRemaining } from "@/lib/otp";

export async function POST(request: NextRequest) {
  let userId: string | undefined;

  try {
    const payload = await request.json();
    userId = payload?.userId;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.firstLoginAt)),
    });

    if (!user) {
      return NextResponse.json({ error: "Verification session not found" }, { status: 404 });
    }

    await createOtpForUser(user.id, user.email, user.firstName, true);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof OtpError && error.code === "cooldown") {
      const retryAfter = userId ? await getOtpResendCooldownRemaining(userId) : 60;

      return NextResponse.json(
        { error: error.message, code: error.code, retryAfter },
        { status: 429 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to resend verification code";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
