import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const SESSION_SECRET = process.env.SESSION_SECRET!;
const COOKIE_NAME = "session";

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

export function getSecretKey() {
  return new TextEncoder().encode(SESSION_SECRET);
}

export type ProfileRole = typeof profiles.$inferSelect.role;

function mapLegacyRoleToProfileRole(role: typeof users.$inferSelect.role): ProfileRole {
  if (role === "admin") return "admin";
  if (role === "manager") return "project_manager";
  return "beneficiary";
}

function mapProfileRoleToLegacyRole(role: ProfileRole): typeof users.$inferSelect.role {
  if (role === "admin") return "admin";
  if (role === "project_manager") return "manager";
  return "user";
}

export async function resolveUserRole(
  userId: string,
  fallbackRole?: typeof users.$inferSelect.role
): Promise<ProfileRole> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (profile?.role) {
    return profile.role;
  }

  return mapLegacyRoleToProfileRole(fallbackRole ?? "user");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());

  return token;
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as { userId: string };
  } catch {
    return null;
  }
}

export type SessionUser = Omit<typeof users.$inferSelect, "role"> & {
  role: ProfileRole;
};

export async function getSession(): Promise<{ userId: string; user: SessionUser } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    return null;
  }

  const role = await resolveUserRole(user.id, user.role);

  return { userId: session.userId, user: { ...user, role } };
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: ProfileRole = "beneficiary",
  department?: string
) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName,
      lastName,
      role: mapProfileRoleToLegacyRole(role),
      department,
    })
    .returning();

  await db.insert(profiles).values({
    userId: newUser.id,
    role,
  });

  return newUser;
}

export async function loginUser(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  return user;
}
