import { pgTable, text, timestamp, uuid, varchar, integer, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "manager", "user"]);
export const profileRoleEnum = pgEnum("profile_role", ["admin", "project_manager", "beneficiary", "donor"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: roleEnum("role").default("user").notNull(),
  department: varchar("department", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  role: profileRoleEnum("role").default("beneficiary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  donorId: varchar("donor_id", { length: 255 }),
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

export const donorTypeEnum = pgEnum("donor_type", ["government", "foundation", "corporate", "individual", "multilateral", "ngo"]);

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

export const proposalStatusEnum = pgEnum("proposal_status", ["draft", "submitted", "under_review", "approved", "rejected", "withdrawn"]);

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: proposalStatusEnum("status").default("draft").notNull(),
  amountRequested: integer("amount_requested").notNull(),
  amountApproved: integer("amount_approved"),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  submissionDate: timestamp("submission_date"),
  decisionDate: timestamp("decision_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  description: text("description"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed"]);

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("pending").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  dueDate: timestamp("due_date"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  completedAt: timestamp("completed_at"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskDocuments = pgTable("task_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetAllocations = pgTable("budget_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  plannedAmount: integer("planned_amount").notNull(),
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
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  amount: integer("amount").notNull(),
  disbursedAt: timestamp("disbursed_at").notNull(),
  reference: varchar("reference", { length: 255 }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  projects: many(projects),
  projectMemberships: many(projectMembers),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  auditLogs: many(auditLogs),
  budgetAllocations: many(budgetAllocations),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

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
  milestones: many(milestones),
  members: many(projectMembers),
  documents: many(projectDocuments),
  proposals: many(proposals),
  tasks: many(tasks),
  budgetAllocations: many(budgetAllocations),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
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

export const milestonesRelations = relations(milestones, ({ one }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
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
  proposals: many(proposals),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
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
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
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
  creator: one(users, {
    fields: [budgetAllocations.createdBy],
    references: [users.id],
  }),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
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

export type Donor = typeof donors.$inferSelect;
export type NewDonor = typeof donors.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskDocument = typeof taskDocuments.$inferSelect;
export type NewTaskDocument = typeof taskDocuments.$inferInsert;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;
export type NewBudgetAllocation = typeof budgetAllocations.$inferInsert;
export type Expenditure = typeof expenditures.$inferSelect;
export type NewExpenditure = typeof expenditures.$inferInsert;
export type DisbursementLog = typeof disbursementLogs.$inferSelect;
export type NewDisbursementLog = typeof disbursementLogs.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
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
