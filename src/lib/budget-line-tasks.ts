import "server-only";

type BudgetTaskNotes = {
  categoryName?: string | null;
  description?: string | null;
  unitCost?: number | null;
  unitCount?: number | null;
  unitType?: string | null;
};

function parseNotes(notes: string | null): BudgetTaskNotes | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" ? parsed as BudgetTaskNotes : null;
  } catch {
    return null;
  }
}

function clampTaskTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (normalized.length <= 255) return normalized;
  return `${normalized.slice(0, 252).trimEnd()}...`;
}

export function buildBudgetLineTaskTitle(activityName: string) {
  return clampTaskTitle(activityName);
}

export function buildBudgetLineTaskDescription(notes: string | null) {
  const parsed = parseNotes(notes);
  if (!parsed) return null;

  const parts = [
    parsed.categoryName?.trim(),
    parsed.description?.trim(),
    parsed.unitCost != null || parsed.unitCount != null
      ? `Unit cost ${parsed.unitCost ?? 0}${parsed.unitType ? ` per ${parsed.unitType}` : ""}; Units ${parsed.unitCount ?? 0}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join("\n") : null;
}
