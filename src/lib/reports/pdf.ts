import "server-only";
import PDFDocument from "pdfkit";
import type { ProjectSummaryData, FinancialReportData, DonorReportData } from "./data";

function formatCurrency(amount: number): string {
  return `ETB ${amount.toLocaleString("en-US")}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function resetCursor(doc: PDFKit.PDFDocument, y = doc.y) {
  doc.x = doc.page.margins.left;
  doc.y = y;
}

function ensurePageSpace(doc: PDFKit.PDFDocument, minHeight = 72) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    resetCursor(doc, doc.page.margins.top);
  }
}

function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  resetCursor(doc, doc.page.margins.top);
  doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
  if (subtitle) {
    doc.moveDown(0.3).fontSize(10).font("Helvetica").fillColor("#666666").text(subtitle, { align: "center" });
  }
  doc.fillColor("#000000").moveDown(0.5);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke("#cccccc");
  doc.moveDown(0.8);
  resetCursor(doc);
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  resetCursor(doc);
  doc.fontSize(14).font("Helvetica-Bold").text(title);
  doc.moveDown(0.4);
}

function addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string) {
  resetCursor(doc);
  doc.fontSize(10).font("Helvetica-Bold").text(`${key}: `, { continued: true }).font("Helvetica").text(value);
}

// ---------- Project Summary PDF ----------

export async function renderProjectSummaryPdf(data: ProjectSummaryData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  addHeader(doc, data.project.name, `Project Summary Report — Generated ${formatDate(data.generatedAt)}`);

  // Project Info
  addSectionTitle(doc, "Project Information");
  addKeyValue(doc, "Status", data.project.status.replace(/_/g, " ").toUpperCase());
  addKeyValue(doc, "Manager", data.manager ? `${data.manager.firstName} ${data.manager.lastName}` : "N/A");
  addKeyValue(doc, "Budget", data.project.totalBudget ? formatCurrency(data.project.totalBudget) : "N/A");
  addKeyValue(doc, "Start Date", formatDate(data.project.startDate));
  addKeyValue(doc, "End Date", formatDate(data.project.endDate));
  if (data.project.description) {
    doc.moveDown(0.3);
    addKeyValue(doc, "Description", data.project.description);
  }
  doc.moveDown(0.8);

  // Milestones
  addSectionTitle(doc, `Milestones (${data.milestones.length})`);
  if (data.milestones.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No milestones defined.");
  } else {
    for (const m of data.milestones) {
      doc.fontSize(10).font("Helvetica-Bold").text(`• ${m.title}`, { continued: true })
        .font("Helvetica").text(`  —  ${m.status} | Due: ${formatDate(m.dueDate)}`);
    }
  }
  doc.moveDown(0.8);

  // Tasks
  addSectionTitle(doc, `Tasks (${data.tasks.length})`);
  if (data.tasks.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No tasks created.");
  } else {
    const completed = data.tasks.filter((t) => t.status === "completed").length;
    const avgProgress = data.tasks.length > 0
      ? Math.round(data.tasks.reduce((s, t) => s + t.progress, 0) / data.tasks.length)
      : 0;
    doc.fontSize(10).font("Helvetica")
      .text(`Completed: ${completed}/${data.tasks.length} | Average Progress: ${avgProgress}%`);
    doc.moveDown(0.3);

    for (const t of data.tasks.slice(0, 30)) {
      const assignee = t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned";
      doc.fontSize(9).font("Helvetica")
        .text(`• ${t.title} — ${t.status} | ${t.priority} | ${t.progress}% | ${assignee} | Due: ${formatDate(t.dueDate)}`);
    }
    if (data.tasks.length > 30) {
      doc.fontSize(9).font("Helvetica").text(`... and ${data.tasks.length - 30} more tasks`);
    }
  }
  doc.moveDown(0.8);

  // Team
  addSectionTitle(doc, `Team Members (${data.members.length})`);
  if (data.members.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No team members assigned.");
  } else {
    for (const m of data.members) {
      doc.fontSize(10).font("Helvetica")
        .text(`• ${m.user.firstName} ${m.user.lastName} (${m.user.email}) — ${m.role}`);
    }
  }

  return pdfToBuffer(doc);
}

// ---------- Financial Report PDF ----------

export async function renderFinancialReportPdf(data: FinancialReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  const tableHeaders = ["Project", "Planned", "Spent", "Disbursed", "Physical%", "Financial%", "Variance%", "Status"];
  const colWidths = [180, 90, 90, 90, 70, 70, 70, 60];
  const cellPaddingX = 6;
  const cellPaddingY = 6;
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);

  const drawFinancialTableHeader = () => {
    ensurePageSpace(doc, 28);
    const startX = doc.page.margins.left;
    const startY = doc.y;
    let x = startX;

    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
    for (let i = 0; i < tableHeaders.length; i++) {
      doc.text(tableHeaders[i], x + cellPaddingX, startY + cellPaddingY, {
        width: colWidths[i] - cellPaddingX * 2,
        align: "left",
      });
      x += colWidths[i];
    }

    const headerHeight = 22;
    doc
      .rect(startX, startY, tableWidth, headerHeight)
      .lineWidth(0.6)
      .strokeColor("#cccccc")
      .stroke();

    resetCursor(doc, startY + headerHeight + 6);
  };

  addHeader(doc, "Financial Performance Report", `Generated ${formatDate(data.generatedAt)}`);

  // Portfolio totals
  addSectionTitle(doc, "Portfolio Summary");
  doc.fontSize(10).font("Helvetica");
  addKeyValue(doc, "Planned Budget", formatCurrency(data.totals.plannedBudget));
  addKeyValue(doc, "Spent Amount", formatCurrency(data.totals.spentAmount));
  addKeyValue(doc, "Disbursed Amount", formatCurrency(data.totals.disbursedAmount));
  addKeyValue(doc, "Physical Performance", `${data.totals.physicalPerformance}%`);
  addKeyValue(doc, "Financial Performance", `${data.totals.financialPerformance}%`);
  addKeyValue(doc, "Tasks", `${data.totals.completedTasks} completed / ${data.totals.totalTasks} total`);
  doc.moveDown(0.8);

  // Per-project table
  addSectionTitle(doc, "Project Breakdown");
  drawFinancialTableHeader();

  doc.font("Helvetica").fontSize(8).fillColor("#000000");
  for (const row of data.rows) {
    const name = row.projectName.length > 28 ? `${row.projectName.slice(0, 28)}...` : row.projectName;
    const cells = [
      name,
      formatCurrency(row.plannedBudget),
      formatCurrency(row.spentAmount),
      formatCurrency(row.disbursedAmount),
      `${row.physicalPerformance}%`,
      `${row.financialPerformance}%`,
      `${row.variance > 0 ? "+" : ""}${row.variance}%`,
      row.status.replace(/_/g, " "),
    ];

    const textHeight = cells.reduce((maxHeight, cell, index) => {
      const cellHeight = doc.heightOfString(cell, {
        width: colWidths[index] - cellPaddingX * 2,
        align: "left",
      });
      return Math.max(maxHeight, cellHeight);
    }, 0);
    const rowHeight = Math.max(20, textHeight + cellPaddingY * 2);

    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      resetCursor(doc, doc.page.margins.top);
      addSectionTitle(doc, "Project Breakdown (continued)");
      drawFinancialTableHeader();
    }

    let x = doc.page.margins.left;
    const rowY = doc.y;

    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x + cellPaddingX, rowY + cellPaddingY, {
        width: colWidths[i] - cellPaddingX * 2,
        align: "left",
      });
      x += colWidths[i];
    }

    doc
      .rect(doc.page.margins.left, rowY, tableWidth, rowHeight)
      .lineWidth(0.4)
      .strokeColor("#dddddd")
      .stroke();

    resetCursor(doc, rowY + rowHeight + 4);
  }
  doc.moveDown(0.6);
  resetCursor(doc);

  // Budget Lines
  if (data.budgetLines.length > 0) {
    ensurePageSpace(doc, 120);
    addSectionTitle(doc, "Budget Allocations");
    for (const b of data.budgetLines.slice(0, 30)) {
      ensurePageSpace(doc, 24);
      doc.fontSize(9).font("Helvetica")
        .text(`• ${b.activityName} — ${formatCurrency(b.plannedAmount)} (${b.projectName})`);
    }
  }

  return pdfToBuffer(doc);
}

// ---------- Donor Report PDF ----------

export async function renderDonorReportPdf(data: DonorReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  addHeader(doc, `Donor Report: ${data.donor.name}`, `Generated ${formatDate(data.generatedAt)}`);

  // Donor Info
  addSectionTitle(doc, "Donor Information");
  addKeyValue(doc, "Type", data.donor.type);
  addKeyValue(doc, "Contact Person", data.donor.contactPerson ?? "N/A");
  addKeyValue(doc, "Email", data.donor.email ?? "N/A");
  addKeyValue(doc, "Phone", data.donor.phone ?? "N/A");
  doc.moveDown(0.5);

  // Financial totals
  addSectionTitle(doc, "Financial Summary");
  addKeyValue(doc, "Total Planned Budget (across linked projects)", formatCurrency(data.totals.plannedBudget));
  addKeyValue(doc, "Total Spent", formatCurrency(data.totals.spentAmount));
  addKeyValue(doc, "Total Disbursed by Donor", formatCurrency(data.totals.disbursedAmount));
  doc.moveDown(0.8);

  // Linked projects
  addSectionTitle(doc, `Linked Projects (${data.projects.length})`);
  if (data.projects.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No projects linked to this donor.");
  } else {
    for (const p of data.projects) {
      doc.fontSize(10).font("Helvetica-Bold").text(p.projectName);
      doc.fontSize(9).font("Helvetica")
        .text(`  Status: ${p.status} | Planned: ${formatCurrency(p.plannedBudget)} | Spent: ${formatCurrency(p.spentAmount)} | Disbursed: ${formatCurrency(p.disbursedAmount)}`);
      doc.text(`  Physical: ${p.physicalPerformance}% | Financial: ${p.financialPerformance}%`);
      doc.moveDown(0.4);
    }
  }

  return pdfToBuffer(doc);
}
