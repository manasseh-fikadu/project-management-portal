import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

const DEFAULT_SELF_REGISTERED_ROLE = "team_member" as const;

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, department } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Email, password, first name, and last name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const user = await registerUser(
      email,
      password,
      firstName,
      lastName,
      DEFAULT_SELF_REGISTERED_ROLE,
      department
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: DEFAULT_SELF_REGISTERED_ROLE,
        department: user.department,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
