import "server-only";

import { and, eq } from "drizzle-orm";
import { db, users } from "@/db";

export async function getActiveUserById(userId: string) {
  return db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.isActive, true)),
    columns: {
      id: true,
    },
  });
}
