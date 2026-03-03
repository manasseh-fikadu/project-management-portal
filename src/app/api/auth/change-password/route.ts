import { NextRequest, NextResponse } from "next/server";
import { changeUserPassword, getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    const hasValidCurrentPassword =
      typeof currentPassword === "string" && currentPassword.trim() !== "";
    const hasValidNewPassword = typeof newPassword === "string" && newPassword.trim() !== "";
    const hasValidConfirmPassword =
      typeof confirmPassword === "string" && confirmPassword.trim() !== "";

    if (!hasValidCurrentPassword || !hasValidNewPassword || !hasValidConfirmPassword) {
      return NextResponse.json(
        { error: "Current password, new password, and confirm password are required" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
    }

    await changeUserPassword(session.user.id, currentPassword, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    if (error instanceof Error) {
      const knownClientErrors: Record<string, { status: number; message: string }> = {
        "Current password is incorrect": { status: 400, message: "Current password is incorrect" },
        "Password must be at least 8 characters": {
          status: 400,
          message: "Password must be at least 8 characters",
        },
        "User not found": { status: 404, message: "User not found" },
      };

      const clientError = knownClientErrors[error.message];
      if (clientError) {
        return NextResponse.json({ error: clientError.message }, { status: clientError.status });
      }
    }

    console.error("Error changing password:", error);
    return NextResponse.json({ error: "Unable to change password" }, { status: 500 });
  }
}
