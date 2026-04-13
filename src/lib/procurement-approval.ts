import type { ProfileRole } from "@/lib/auth";

export const PROCUREMENT_ADMIN_APPROVAL_THRESHOLD = 100_000;

export type ProcurementApprovalRole = "project_manager" | "admin";

export function getRequiredProcurementApprovalRole(amount: number): ProcurementApprovalRole {
  return amount <= PROCUREMENT_ADMIN_APPROVAL_THRESHOLD ? "project_manager" : "admin";
}

export function getRequiredProcurementApprovalThreshold(amount: number): number {
  void amount;
  return PROCUREMENT_ADMIN_APPROVAL_THRESHOLD;
}

export function canUserApproveProcurement(role: ProfileRole, amount: number): boolean {
  if (role === "admin") {
    return true;
  }

  return role === "project_manager" && amount <= PROCUREMENT_ADMIN_APPROVAL_THRESHOLD;
}

export function getProcurementApprovalLabel(amount: number): string {
  return getRequiredProcurementApprovalRole(amount) === "project_manager"
    ? `Project manager approval up to ${PROCUREMENT_ADMIN_APPROVAL_THRESHOLD.toLocaleString()}`
    : `Admin approval above ${PROCUREMENT_ADMIN_APPROVAL_THRESHOLD.toLocaleString()}`;
}
