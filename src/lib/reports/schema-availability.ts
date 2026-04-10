import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";

let cachedAvailability: boolean | null = null;

export function isMissingReportingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return value.code === "42P01" || (typeof value.message === "string" && value.message.includes('relation "reporting_'));
}

export async function hasReportingTables(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;

  try {
    const result = await db.execute(sql`
      SELECT
        to_regclass('public.reporting_profiles') AS reporting_profiles,
        to_regclass('public.reporting_results') AS reporting_results,
        to_regclass('public.reporting_budget_lines') AS reporting_budget_lines,
        to_regclass('public.reporting_transactions') AS reporting_transactions
    `);

    const row = result.rows[0] as Record<string, unknown> | undefined;
    cachedAvailability = Boolean(
      row?.reporting_profiles &&
      row?.reporting_results &&
      row?.reporting_budget_lines &&
      row?.reporting_transactions
    );
    return cachedAvailability;
  } catch {
    cachedAvailability = false;
    return false;
  }
}
