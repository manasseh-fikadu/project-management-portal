import { pgTable, text, timestamp, uuid, varchar, integer, boolean, pgEnum, jsonb, uniqueIndex, check, index, AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "manager", "user"]);
export const profileRoleEnum = pgEnum("profile_role", ["admin", "project_manager", "team_member", "donor"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);
export const emailOutboxStatusEnum = pgEnum("email_outbox_status", ["pending", "processing", "sent", "failed"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "deadline_approaching", "deadline_overdue",
  "approval_pending", "approval_decision",
  "task_assigned", "milestone_updated"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: roleEnum("role").default("user").notNull(),
  department: varchar("department", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  passwordChangedAt: timestamp("password_changed_at"),
  firstLoginAt: timestamp("first_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  role: profileRoleEnum("role").default("team_member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  otpHash: varchar("otp_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 50 }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: emailOutboxStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  processorId: varchar("processor_id", { length: 100 }),
  processingStartedAt: timestamp("processing_started_at"),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  changes: jsonb("changes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectStatusEnum = pgEnum("project_status", ["planning", "active", "on_hold", "completed", "cancelled"]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("planning").notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  totalBudget: integer("total_budget").default(0),
  spentBudget: integer("spent_budget").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  managerId: uuid("manager_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata"),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const milestoneStatusEnum = pgEnum("milestone_status", ["pending", "in_progress", "completed", "cancelled"]);

export const milestones = pgTable("milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: milestoneStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const donorStatusEnum = pgEnum("donor_status", ["active", "pending", "completed", "withdrawn"]);

export const donorTypeEnum = pgEnum("donor_type", ["government", "foundation", "corporate", "individual", "multilateral", "ngo"]);
export const reportingTemplateEnum = pgEnum("reporting_template", ["agra_budget_breakdown", "eif_cpd_annex", "ppg_boost"]);
export const reportingNodeTypeEnum = pgEnum("reporting_node_type", ["outcome", "output", "activity", "sub_activity"]);
export const reportingFundingFacilityEnum = pgEnum("reporting_funding_facility", ["ff1", "ff2", "eif", "other", "unspecified"]);
export const reportingTransactionTypeEnum = pgEnum("reporting_transaction_type", ["expenditure", "disbursement"]);
export const disbursementDirectionValues = ["outward", "inward"] as const;
export type DisbursementDirection = typeof disbursementDirectionValues[number];
export const disbursementDirectionEnum = pgEnum("disbursement_direction", disbursementDirectionValues);

export const donors = pgTable("donors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: donorTypeEnum("type").notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  website: varchar("website", { length: 500 }),
  grantTypes: text("grant_types"),
  focusAreas: text("focus_areas"),
  averageGrantSize: integer("average_grant_size"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectDonors = pgTable("project_donors", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  status: donorStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectDonorUnique: uniqueIndex("project_donors_project_id_donor_id_key").on(table.projectId, table.donorId),
}));

export const proposalStatusEnum = pgEnum("proposal_status", ["draft", "submitted", "under_review", "approved", "rejected", "withdrawn"]);
export const proposalTypeEnum = pgEnum("proposal_type", ["grant", "tor"]);

export const proposalTemplates = pgTable("proposal_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  sections: jsonb("sections").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  proposalType: proposalTypeEnum("proposal_type").default("grant").notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  templateId: uuid("template_id").references(() => proposalTemplates.id, { onDelete: "set null" }),
  status: proposalStatusEnum("status").default("draft").notNull(),
  amountRequested: integer("amount_requested").notNull(),
  amountApproved: integer("amount_approved"),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  torCode: varchar("tor_code", { length: 100 }),
  torSubmissionRef: varchar("tor_submission_ref", { length: 150 }),
  templateData: jsonb("template_data"),
  lookupText: text("lookup_text"),
  submissionDate: timestamp("submission_date"),
  decisionDate: timestamp("decision_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  description: text("description"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  proposalTypeIdx: index("proposals_proposal_type_idx").on(table.proposalType),
  proposalStatusIdx: index("proposals_status_idx").on(table.status),
  proposalDonorIdx: index("proposals_donor_id_idx").on(table.donorId),
  proposalProjectIdx: index("proposals_project_id_idx").on(table.projectId),
  proposalSubmissionDateIdx: index("proposals_submission_date_idx").on(table.submissionDate),
  proposalCreatedAtIdx: index("proposals_created_at_idx").on(table.createdAt),
}));

export const proposalDocuments = pgTable("proposal_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata"),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed"]);

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("pending").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  dueDate: timestamp("due_date"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  progress: integer("progress").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  progressRangeCheck: check("tasks_progress_range_check", sql`${table.progress} >= 0 AND ${table.progress} <= 100`),
  budgetAllocationIdIdx: uniqueIndex("tasks_budget_allocation_id_idx").on(table.budgetAllocationId),
}));

export const taskMilestones = pgTable("task_milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskMilestoneUnique: uniqueIndex("task_milestones_task_id_milestone_id_key").on(table.taskId, table.milestoneId),
  taskIdIdx: index("task_milestones_task_id_idx").on(table.taskId),
  milestoneIdIdx: index("task_milestones_milestone_id_idx").on(table.milestoneId),
}));

export const taskDocuments = pgTable("task_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata"),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetAllocations = pgTable("budget_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  plannedAmount: integer("planned_amount").notNull(),
  q1Amount: integer("q1_amount").default(0).notNull(),
  q2Amount: integer("q2_amount").default(0).notNull(),
  q3Amount: integer("q3_amount").default(0).notNull(),
  q4Amount: integer("q4_amount").default(0).notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expenditures = pgTable("expenditures", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  activityName: varchar("activity_name", { length: 255 }),
  amount: integer("amount").notNull(),
  expenditureDate: timestamp("expenditure_date").notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const disbursementLogs = pgTable("disbursement_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  expenditureId: uuid("expenditure_id").references(() => expenditures.id, { onDelete: "set null" }),
  direction: disbursementDirectionEnum("direction").default("outward").notNull(),
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  amount: integer("amount").notNull(),
  disbursedAt: timestamp("disbursed_at").notNull(),
  reference: varchar("reference", { length: 255 }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const donorAccessTokens = pgTable("donor_access_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportingProfiles = pgTable("reporting_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  primaryTemplate: reportingTemplateEnum("primary_template").default("eif_cpd_annex").notNull(),
  country: varchar("country", { length: 120 }),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  reportingStartDate: timestamp("reporting_start_date"),
  reportingEndDate: timestamp("reporting_end_date"),
  annualYear: integer("annual_year"),
  fundingFacility1Label: varchar("funding_facility_1_label", { length: 120 }),
  fundingFacility2Label: varchar("funding_facility_2_label", { length: 120 }),
  otherFundingLabel: varchar("other_funding_label", { length: 120 }),
  leadAgency: varchar("lead_agency", { length: 255 }),
  implementingPartner: varchar("implementing_partner", { length: 255 }),
  procurementNotes: text("procurement_notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportingProfilesProjectUnique: uniqueIndex("reporting_profiles_project_id_key").on(table.projectId),
}));

export const reportingResults = pgTable("reporting_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => reportingProfiles.id, { onDelete: "set null" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => reportingResults.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  sourceBudgetAllocationId: uuid("source_budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  nodeType: reportingNodeTypeEnum("node_type").notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  indicatorCode: varchar("indicator_code", { length: 100 }),
  indicatorLabel: text("indicator_label"),
  baselineValue: integer("baseline_value"),
  targetValue: integer("target_value"),
  actualValue: integer("actual_value"),
  unitType: varchar("unit_type", { length: 100 }),
  targetGroup: text("target_group"),
  responsibleEntity: varchar("responsible_entity", { length: 255 }),
  leadEntity: varchar("lead_entity", { length: 255 }),
  meansOfVerification: text("means_of_verification"),
  assumptions: text("assumptions"),
  category: varchar("category", { length: 120 }),
  procurementCategory: varchar("procurement_category", { length: 120 }),
  procurementMethod: varchar("procurement_method", { length: 120 }),
  comment: text("comment"),
  executionRate: integer("execution_rate"),
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportingResultsProjectIdx: index("reporting_results_project_id_idx").on(table.projectId),
  reportingResultsParentIdx: index("reporting_results_parent_id_idx").on(table.parentId),
  reportingResultsCodeIdx: index("reporting_results_code_idx").on(table.projectId, table.code),
}));

export const reportingBudgetLines = pgTable("reporting_budget_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => reportingProfiles.id, { onDelete: "set null" }),
  reportingResultId: uuid("reporting_result_id").references(() => reportingResults.id, { onDelete: "set null" }),
  sourceBudgetAllocationId: uuid("source_budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  accountCode: varchar("account_code", { length: 100 }),
  accountTitle: varchar("account_title", { length: 255 }),
  lineDescription: text("line_description"),
  fundingFacility: reportingFundingFacilityEnum("funding_facility").default("unspecified").notNull(),
  otherFundingSource: varchar("other_funding_source", { length: 255 }),
  unit: varchar("unit", { length: 80 }),
  quantity: integer("quantity"),
  unitCost: integer("unit_cost"),
  plannedAmount: integer("planned_amount").default(0).notNull(),
  actualAmount: integer("actual_amount").default(0).notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  year: integer("year"),
  month: integer("month"),
  quarter: integer("quarter"),
  procurementCategory: varchar("procurement_category", { length: 120 }),
  procurementMethod: varchar("procurement_method", { length: 120 }),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportingBudgetLinesProjectIdx: index("reporting_budget_lines_project_id_idx").on(table.projectId),
  reportingBudgetLinesResultIdx: index("reporting_budget_lines_result_id_idx").on(table.reportingResultId),
  reportingBudgetLinesAccountIdx: index("reporting_budget_lines_account_idx").on(table.projectId, table.accountCode),
}));

export const reportingTransactions = pgTable("reporting_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  reportingResultId: uuid("reporting_result_id").references(() => reportingResults.id, { onDelete: "set null" }),
  reportingBudgetLineId: uuid("reporting_budget_line_id").references(() => reportingBudgetLines.id, { onDelete: "set null" }),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  sourceExpenditureId: uuid("source_expenditure_id").references(() => expenditures.id, { onDelete: "set null" }),
  sourceDisbursementId: uuid("source_disbursement_id").references(() => disbursementLogs.id, { onDelete: "set null" }),
  transactionType: reportingTransactionTypeEnum("transaction_type").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  reportingTransactionsProjectIdx: index("reporting_transactions_project_id_idx").on(table.projectId),
  reportingTransactionsBudgetLineIdx: index("reporting_transactions_budget_line_id_idx").on(table.reportingBudgetLineId),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  otpCodes: many(otpCodes),
  projects: many(projects),
  projectMemberships: many(projectMembers),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  auditLogs: many(auditLogs),
  proposalTemplates: many(proposalTemplates),
  proposalDocuments: many(proposalDocuments),
  budgetAllocations: many(budgetAllocations),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  user: one(users, {
    fields: [otpCodes.userId],
    references: [users.id],
  }),
}));

export const emailOutboxRelations = relations(emailOutbox, () => ({}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  manager: one(users, {
    fields: [projects.managerId],
    references: [users.id],
  }),
  donor: one(donors, {
    fields: [projects.donorId],
    references: [donors.id],
  }),
  projectDonors: many(projectDonors),
  milestones: many(milestones),
  members: many(projectMembers),
  documents: many(projectDocuments),
  proposals: many(proposals),
  tasks: many(tasks),
  budgetAllocations: many(budgetAllocations),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  reportingProfile: one(reportingProfiles, {
    fields: [projects.id],
    references: [reportingProfiles.projectId],
  }),
  reportingResults: many(reportingResults),
  reportingBudgetLines: many(reportingBudgetLines),
  reportingTransactions: many(reportingTransactions),
}));

export const projectDocumentsRelations = relations(projectDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDocuments.projectId],
    references: [projects.id],
  }),
  uploader: one(users, {
    fields: [projectDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  taskMilestones: many(taskMilestones),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const donorsRelations = relations(donors, ({ many }) => ({
  projects: many(projects),
  projectDonors: many(projectDonors),
  proposals: many(proposals),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  accessTokens: many(donorAccessTokens),
}));

export const donorAccessTokensRelations = relations(donorAccessTokens, ({ one }) => ({
  donor: one(donors, {
    fields: [donorAccessTokens.donorId],
    references: [donors.id],
  }),
  creator: one(users, {
    fields: [donorAccessTokens.createdBy],
    references: [users.id],
  }),
}));

export const projectDonorsRelations = relations(projectDonors, ({ one }) => ({
  project: one(projects, {
    fields: [projectDonors.projectId],
    references: [projects.id],
  }),
  donor: one(donors, {
    fields: [projectDonors.donorId],
    references: [donors.id],
  }),
}));

export const proposalTemplatesRelations = relations(proposalTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [proposalTemplates.createdBy],
    references: [users.id],
  }),
  proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  donor: one(donors, {
    fields: [proposals.donorId],
    references: [donors.id],
  }),
  project: one(projects, {
    fields: [proposals.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [proposals.createdBy],
    references: [users.id],
  }),
  template: one(proposalTemplates, {
    fields: [proposals.templateId],
    references: [proposalTemplates.id],
  }),
  documents: many(proposalDocuments),
}));

export const proposalDocumentsRelations = relations(proposalDocuments, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalDocuments.proposalId],
    references: [proposals.id],
  }),
  uploader: one(users, {
    fields: [proposalDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [tasks.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
  documents: many(taskDocuments),
  expenditures: many(expenditures),
  taskMilestones: many(taskMilestones),
}));

export const taskMilestonesRelations = relations(taskMilestones, ({ one }) => ({
  task: one(tasks, {
    fields: [taskMilestones.taskId],
    references: [tasks.id],
  }),
  milestone: one(milestones, {
    fields: [taskMilestones.milestoneId],
    references: [milestones.id],
  }),
}));

export const taskDocumentsRelations = relations(taskDocuments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDocuments.taskId],
    references: [tasks.id],
  }),
  uploader: one(users, {
    fields: [taskDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const budgetAllocationsRelations = relations(budgetAllocations, ({ one, many }) => ({
  project: one(projects, {
    fields: [budgetAllocations.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [budgetAllocations.id],
    references: [tasks.budgetAllocationId],
  }),
  assignee: one(users, {
    fields: [budgetAllocations.assignedTo],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [budgetAllocations.createdBy],
    references: [users.id],
  }),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  reportingResults: many(reportingResults),
  reportingBudgetLines: many(reportingBudgetLines),
}));

export const expendituresRelations = relations(expenditures, ({ one, many }) => ({
  project: one(projects, {
    fields: [expenditures.projectId],
    references: [projects.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [expenditures.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  task: one(tasks, {
    fields: [expenditures.taskId],
    references: [tasks.id],
  }),
  donor: one(donors, {
    fields: [expenditures.donorId],
    references: [donors.id],
  }),
  creator: one(users, {
    fields: [expenditures.createdBy],
    references: [users.id],
  }),
  disbursementLogs: many(disbursementLogs),
  reportingTransactions: many(reportingTransactions),
}));

export const disbursementLogsRelations = relations(disbursementLogs, ({ one }) => ({
  project: one(projects, {
    fields: [disbursementLogs.projectId],
    references: [projects.id],
  }),
  donor: one(donors, {
    fields: [disbursementLogs.donorId],
    references: [donors.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [disbursementLogs.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  expenditure: one(expenditures, {
    fields: [disbursementLogs.expenditureId],
    references: [expenditures.id],
  }),
  creator: one(users, {
    fields: [disbursementLogs.createdBy],
    references: [users.id],
  }),
}));

export const reportingProfilesRelations = relations(reportingProfiles, ({ one, many }) => ({
  project: one(projects, {
    fields: [reportingProfiles.projectId],
    references: [projects.id],
  }),
  results: many(reportingResults),
  budgetLines: many(reportingBudgetLines),
}));

export const reportingResultsRelations = relations(reportingResults, ({ one, many }) => ({
  project: one(projects, {
    fields: [reportingResults.projectId],
    references: [projects.id],
  }),
  profile: one(reportingProfiles, {
    fields: [reportingResults.profileId],
    references: [reportingProfiles.id],
  }),
  parent: one(reportingResults, {
    fields: [reportingResults.parentId],
    references: [reportingResults.id],
    relationName: "reporting_result_hierarchy",
  }),
  children: many(reportingResults, {
    relationName: "reporting_result_hierarchy",
  }),
  task: one(tasks, {
    fields: [reportingResults.taskId],
    references: [tasks.id],
  }),
  milestone: one(milestones, {
    fields: [reportingResults.milestoneId],
    references: [milestones.id],
  }),
  sourceBudgetAllocation: one(budgetAllocations, {
    fields: [reportingResults.sourceBudgetAllocationId],
    references: [budgetAllocations.id],
  }),
  budgetLines: many(reportingBudgetLines),
  transactions: many(reportingTransactions),
}));

export const reportingBudgetLinesRelations = relations(reportingBudgetLines, ({ one, many }) => ({
  project: one(projects, {
    fields: [reportingBudgetLines.projectId],
    references: [projects.id],
  }),
  profile: one(reportingProfiles, {
    fields: [reportingBudgetLines.profileId],
    references: [reportingProfiles.id],
  }),
  result: one(reportingResults, {
    fields: [reportingBudgetLines.reportingResultId],
    references: [reportingResults.id],
  }),
  sourceBudgetAllocation: one(budgetAllocations, {
    fields: [reportingBudgetLines.sourceBudgetAllocationId],
    references: [budgetAllocations.id],
  }),
  transactions: many(reportingTransactions),
}));

export const reportingTransactionsRelations = relations(reportingTransactions, ({ one }) => ({
  project: one(projects, {
    fields: [reportingTransactions.projectId],
    references: [projects.id],
  }),
  result: one(reportingResults, {
    fields: [reportingTransactions.reportingResultId],
    references: [reportingResults.id],
  }),
  budgetLine: one(reportingBudgetLines, {
    fields: [reportingTransactions.reportingBudgetLineId],
    references: [reportingBudgetLines.id],
  }),
  donor: one(donors, {
    fields: [reportingTransactions.donorId],
    references: [donors.id],
  }),
  sourceExpenditure: one(expenditures, {
    fields: [reportingTransactions.sourceExpenditureId],
    references: [expenditures.id],
  }),
  sourceDisbursement: one(disbursementLogs, {
    fields: [reportingTransactions.sourceDisbursementId],
    references: [disbursementLogs.id],
  }),
}));

export type Donor = typeof donors.$inferSelect;
export type NewDonor = typeof donors.$inferInsert;
export type ProjectDonor = typeof projectDonors.$inferSelect;
export type NewProjectDonor = typeof projectDonors.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type NewProposalTemplate = typeof proposalTemplates.$inferInsert;
export type ProposalDocument = typeof proposalDocuments.$inferSelect;
export type NewProposalDocument = typeof proposalDocuments.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskMilestone = typeof taskMilestones.$inferSelect;
export type NewTaskMilestone = typeof taskMilestones.$inferInsert;
export type TaskDocument = typeof taskDocuments.$inferSelect;
export type NewTaskDocument = typeof taskDocuments.$inferInsert;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;
export type NewBudgetAllocation = typeof budgetAllocations.$inferInsert;
export type Expenditure = typeof expenditures.$inferSelect;
export type NewExpenditure = typeof expenditures.$inferInsert;
export type DisbursementLog = typeof disbursementLogs.$inferSelect;
export type NewDisbursementLog = typeof disbursementLogs.$inferInsert;
export type ReportingProfile = typeof reportingProfiles.$inferSelect;
export type NewReportingProfile = typeof reportingProfiles.$inferInsert;
export type ReportingResult = typeof reportingResults.$inferSelect;
export type NewReportingResult = typeof reportingResults.$inferInsert;
export type ReportingBudgetLine = typeof reportingBudgetLines.$inferSelect;
export type NewReportingBudgetLine = typeof reportingBudgetLines.$inferInsert;
export type ReportingTransaction = typeof reportingTransactions.$inferSelect;
export type NewReportingTransaction = typeof reportingTransactions.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;
export type EmailOutbox = typeof emailOutbox.$inferSelect;
export type NewEmailOutbox = typeof emailOutbox.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type DonorAccessToken = typeof donorAccessTokens.$inferSelect;
export type NewDonorAccessToken = typeof donorAccessTokens.$inferInsert;
