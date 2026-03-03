import "server-only";
import ExcelJS from "exceljs";
import type { ProjectSummaryData, FinancialReportData, DonorReportData } from "./data";

function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });
}

function autoWidth(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    if (!column.eachCell) return;
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    column.width = Math.min(maxLength + 3, 50);
  });
}

// ---------- Project Summary Excel ----------

export async function renderProjectSummaryExcel(data: ProjectSummaryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoTRI Project Portal";
  workbook.created = data.generatedAt;

  // Overview sheet
  const overview = workbook.addWorksheet("Overview");
  overview.addRow(["Project Summary Report"]).font = { bold: true, size: 16 };
  overview.addRow([`Generated: ${formatDate(data.generatedAt)}`]);
  overview.addRow([]);
  overview.addRow(["Field", "Value"]);
  styleHeaderRow(overview.getRow(4));
  overview.addRow(["Name", data.project.name]);
  overview.addRow(["Status", data.project.status.replace("_", " ")]);
  overview.addRow(["Manager", data.manager ? `${data.manager.firstName} ${data.manager.lastName}` : "N/A"]);
  overview.addRow(["Budget", data.project.totalBudget ?? "N/A"]);
  overview.addRow(["Start Date", formatDate(data.project.startDate)]);
  overview.addRow(["End Date", formatDate(data.project.endDate)]);
  overview.addRow(["Description", data.project.description ?? ""]);
  autoWidth(overview);

  // Milestones sheet
  const msSheet = workbook.addWorksheet("Milestones");
  msSheet.addRow(["Title", "Status", "Due Date", "Completed"]);
  styleHeaderRow(msSheet.getRow(1));
  for (const m of data.milestones) {
    msSheet.addRow([m.title, m.status, formatDate(m.dueDate), formatDate(m.completedAt)]);
  }
  autoWidth(msSheet);

  // Tasks sheet
  const taskSheet = workbook.addWorksheet("Tasks");
  taskSheet.addRow(["Title", "Status", "Priority", "Progress %", "Assignee", "Due Date"]);
  styleHeaderRow(taskSheet.getRow(1));
  for (const t of data.tasks) {
    taskSheet.addRow([
      t.title,
      t.status,
      t.priority,
      t.progress,
      t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned",
      formatDate(t.dueDate),
    ]);
  }
  autoWidth(taskSheet);

  // Team sheet
  const teamSheet = workbook.addWorksheet("Team");
  teamSheet.addRow(["Name", "Email", "Role"]);
  styleHeaderRow(teamSheet.getRow(1));
  for (const m of data.members) {
    teamSheet.addRow([`${m.user.firstName} ${m.user.lastName}`, m.user.email, m.role]);
  }
  autoWidth(teamSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ---------- Financial Report Excel ----------

export async function renderFinancialReportExcel(data: FinancialReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoTRI Project Portal";
  workbook.created = data.generatedAt;

  // Summary sheet
  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Financial Performance Report"]).font = { bold: true, size: 16 };
  summary.addRow([`Generated: ${formatDate(data.generatedAt)}`]);
  summary.addRow([]);
  summary.addRow(["Metric", "Value"]);
  styleHeaderRow(summary.getRow(4));
  summary.addRow(["Planned Budget", data.totals.plannedBudget]);
  summary.addRow(["Spent Amount", data.totals.spentAmount]);
  summary.addRow(["Disbursed Amount", data.totals.disbursedAmount]);
  summary.addRow(["Physical Performance", `${data.totals.physicalPerformance}%`]);
  summary.addRow(["Financial Performance", `${data.totals.financialPerformance}%`]);
  summary.addRow(["Completed Tasks", `${data.totals.completedTasks} / ${data.totals.totalTasks}`]);
  autoWidth(summary);

  // Performance sheet
  const perfSheet = workbook.addWorksheet("Project Performance");
  perfSheet.addRow([
    "Project", "Planned Budget", "Spent", "Disbursed", "Tasks", "Completed",
    "Physical %", "Financial %", "Variance %", "Status",
  ]);
  styleHeaderRow(perfSheet.getRow(1));
  for (const row of data.rows) {
    perfSheet.addRow([
      row.projectName,
      row.plannedBudget,
      row.spentAmount,
      row.disbursedAmount,
      row.totalTasks,
      row.completedTasks,
      row.physicalPerformance,
      row.financialPerformance,
      row.variance,
      row.status.replace(/_/g, " "),
    ]);
  }
  autoWidth(perfSheet);

  // Budget Lines sheet
  const budgetSheet = workbook.addWorksheet("Budget Allocations");
  budgetSheet.addRow(["Activity", "Planned Amount", "Project"]);
  styleHeaderRow(budgetSheet.getRow(1));
  for (const b of data.budgetLines) {
    budgetSheet.addRow([b.activityName, b.plannedAmount, b.projectName]);
  }
  autoWidth(budgetSheet);

  // Expenditures sheet
  const expSheet = workbook.addWorksheet("Expenditures");
  expSheet.addRow(["Activity", "Amount", "Date", "Project"]);
  styleHeaderRow(expSheet.getRow(1));
  for (const e of data.recentExpenditures) {
    expSheet.addRow([e.activityName ?? "General", e.amount, formatDate(e.expenditureDate), e.projectName]);
  }
  autoWidth(expSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ---------- Donor Report Excel ----------

export async function renderDonorReportExcel(data: DonorReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoTRI Project Portal";
  workbook.created = data.generatedAt;

  // Donor Info sheet
  const info = workbook.addWorksheet("Donor Info");
  info.addRow([`Donor Report: ${data.donor.name}`]).font = { bold: true, size: 16 };
  info.addRow([`Generated: ${formatDate(data.generatedAt)}`]);
  info.addRow([]);
  info.addRow(["Field", "Value"]);
  styleHeaderRow(info.getRow(4));
  info.addRow(["Name", data.donor.name]);
  info.addRow(["Type", data.donor.type]);
  info.addRow(["Contact Person", data.donor.contactPerson ?? "N/A"]);
  info.addRow(["Email", data.donor.email ?? "N/A"]);
  info.addRow(["Phone", data.donor.phone ?? "N/A"]);
  info.addRow([]);
  info.addRow(["Total Planned Budget", data.totals.plannedBudget]);
  info.addRow(["Total Spent", data.totals.spentAmount]);
  info.addRow(["Total Disbursed", data.totals.disbursedAmount]);
  autoWidth(info);

  // Projects sheet
  const projSheet = workbook.addWorksheet("Linked Projects");
  projSheet.addRow([
    "Project", "Status", "Planned Budget", "Spent", "Disbursed",
    "Physical %", "Financial %",
  ]);
  styleHeaderRow(projSheet.getRow(1));
  for (const p of data.projects) {
    projSheet.addRow([
      p.projectName,
      p.status,
      p.plannedBudget,
      p.spentAmount,
      p.disbursedAmount,
      p.physicalPerformance,
      p.financialPerformance,
    ]);
  }
  autoWidth(projSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
