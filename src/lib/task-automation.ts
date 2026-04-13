export type DerivedTaskStatus = "pending" | "in_progress" | "completed";

type TaskAutomationSnapshot = {
  progress?: number | null;
  completedAt?: Date | string | null;
};

export function normalizeMilestoneIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedIds: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      return null;
    }

    normalizedIds.push(trimmed);
  }

  return [...new Set(normalizedIds)];
}

export function deriveTaskStatusFromMilestoneStatuses(
  milestoneStatuses: readonly string[],
): DerivedTaskStatus {
  if (milestoneStatuses.length === 0) {
    return "pending";
  }

  if (milestoneStatuses.every((status) => status === "completed")) {
    return "completed";
  }

  if (milestoneStatuses.some((status) => status === "in_progress" || status === "completed")) {
    return "in_progress";
  }

  return "pending";
}

export function buildDerivedTaskFields(
  task: TaskAutomationSnapshot,
  milestoneStatuses: readonly string[],
  now = new Date(),
) {
  const derivedStatus = deriveTaskStatusFromMilestoneStatuses(milestoneStatuses);

  if (derivedStatus === "completed") {
    return {
      status: derivedStatus,
      progress: 100,
      completedAt: toValidDate(task.completedAt) ?? now,
    };
  }

  const currentProgress = clampProgress(task.progress);

  return {
    status: derivedStatus,
    progress:
      currentProgress >= 100
        ? derivedStatus === "pending"
          ? 0
          : 95
        : currentProgress,
    completedAt: null,
  };
}

function clampProgress(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}
