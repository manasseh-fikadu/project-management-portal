import "server-only";

import ExcelJS from "exceljs";
import type {
  CanonicalBudgetLine,
  CanonicalReportingNode,
  ReportingTemplateData,
} from "./template-data";

function formatDate(date: Date | null): string {
  if (!date) return "Not set";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
}

function autoWidth(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    if (!column.eachCell) return;
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const raw = cell.value == null ? "" : typeof cell.value === "object" && "richText" in cell.value
        ? JSON.stringify(cell.value)
        : String(cell.value);
      maxLength = Math.max(maxLength, raw.length);
    });
    column.width = Math.min(maxLength + 2, 36);
  });
}

function buildNodeDepthMap(nodes: CanonicalReportingNode[]): Map<string, number> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthMap = new Map<string, number>();

  function resolveDepth(node: CanonicalReportingNode): number {
    if (depthMap.has(node.id)) return depthMap.get(node.id)!;
    if (!node.parentId) {
      depthMap.set(node.id, 0);
      return 0;
    }

    const parent = byId.get(node.parentId);
    const depth = parent ? resolveDepth(parent) + 1 : 0;
    depthMap.set(node.id, depth);
    return depth;
  }

  nodes.forEach(resolveDepth);
  return depthMap;
}

function sumBudgetForNode(
  nodeId: string,
  nodeMap: Map<string, CanonicalReportingNode>,
  childrenMap: Map<string | null, CanonicalReportingNode[]>,
  budgetLines: CanonicalBudgetLine[]
): number {
  const ownTotal = budgetLines
    .filter((line) => line.resultId === nodeId)
    .reduce((sum, line) => sum + line.plannedAmount, 0);
  const children = childrenMap.get(nodeId) ?? [];
  return ownTotal + children.reduce((sum, child) => sum + sumBudgetForNode(child.id, nodeMap, childrenMap, budgetLines), 0);
}

function sumFunding(lines: CanonicalBudgetLine[], facility: CanonicalBudgetLine["fundingFacility"], template: ReportingTemplateData["template"]): number {
  return lines.reduce((sum, line) => {
    const effectiveFacility = line.fundingFacility === "unspecified"
      ? (template === "eif-cpd-annex" ? "eif" : "other")
      : line.fundingFacility;
    return effectiveFacility === facility ? sum + line.plannedAmount : sum;
  }, 0);
}

function linesForNode(lines: CanonicalBudgetLine[], nodeId: string | null): CanonicalBudgetLine[] {
  return lines.filter((line) => line.resultId === nodeId);
}

function nodeLabel(node: CanonicalReportingNode, depth: number): string {
  return `${"  ".repeat(depth)}${node.title}`;
}

function addWorkbookCover(workbook: ExcelJS.Workbook, title: string, subtitleLines: string[]) {
  const sheet = workbook.addWorksheet("Overview");
  sheet.addRow([title]).font = { bold: true, size: 16 };
  subtitleLines.forEach((line) => sheet.addRow([line]));
  sheet.addRow([]);
  autoWidth(sheet);
}

function toAlphaCode(index: number): string {
  let value = index + 1;
  let code = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    code = String.fromCharCode(65 + remainder) + code;
    value = Math.floor((value - 1) / 26);
  }

  return code;
}

function resolveAgraGroupNode(
  nodeId: string | null,
  nodeMap: Map<string, CanonicalReportingNode>
): CanonicalReportingNode | null {
  let current = nodeId ? nodeMap.get(nodeId) ?? null : null;
  let fallback = current;

  while (current) {
    if (current.type === "output") return current;
    fallback = current;
    current = current.parentId ? nodeMap.get(current.parentId) ?? null : null;
  }

  return fallback ?? null;
}

function renderAgraWorkbook(data: ReportingTemplateData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoTRI Project Portal";
  workbook.created = new Date();

  const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
  const grouped = new Map<string, { title: string; sortOrder: number; lines: CanonicalBudgetLine[] }>();

  data.budgetLines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.year - b.year)
    .forEach((line, index) => {
      const groupNode = resolveAgraGroupNode(line.resultId, nodeMap);
      const groupKey = groupNode?.id ?? `ungrouped:${line.accountTitle ?? line.lineDescription}`;
      const groupTitle = groupNode?.title ?? line.accountTitle ?? "Budget lines";
      const current = grouped.get(groupKey) ?? {
        title: groupTitle,
        sortOrder: groupNode?.sortOrder ?? index,
        lines: [],
      };
      current.lines.push(line);
      grouped.set(groupKey, current);
    });

  const sheet = workbook.addWorksheet("WRF Budget detail");
  sheet.getCell("B5").value = `Project Title: ${data.project.name}`;
  sheet.getCell("F7").value = data.annualYear;
  sheet.getCell("C8").value = "Account";
  sheet.getCell("D8").value = "Description";
  sheet.getCell("F8").value = "Cost per Unit";
  sheet.getCell("G8").value = "Unit no.";
  sheet.getCell("H8").value = "Total cost";
  sheet.getCell("C9").value = "Code";
  sheet.getCell("F10").value = "A";
  sheet.getCell("G10").value = "B";
  sheet.getCell("H10").value = "C";
  sheet.getCell("J10").value = "Q1";
  sheet.getCell("K10").value = "Q2";
  sheet.getCell("L10").value = "Q3";
  sheet.getCell("M10").value = "Q4";

  styleHeaderRow(sheet.getRow(8));
  styleHeaderRow(sheet.getRow(10));

  let rowNumber = 12;
  Array.from(grouped.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((group, groupIndex) => {
      const categoryCode = toAlphaCode(groupIndex);
      const groupQuarterTotals = group.lines.reduce<[number, number, number, number]>(
        (totals, line) => [
          totals[0] + (line.quarterAmounts[0] ?? 0),
          totals[1] + (line.quarterAmounts[1] ?? 0),
          totals[2] + (line.quarterAmounts[2] ?? 0),
          totals[3] + (line.quarterAmounts[3] ?? 0),
        ],
        [0, 0, 0, 0]
      );
      const groupTotal = group.lines.reduce((sum, line) => sum + line.plannedAmount, 0);

      sheet.getCell(`C${rowNumber}`).value = categoryCode;
      sheet.getCell(`D${rowNumber}`).value = group.title;
      sheet.getCell(`H${rowNumber}`).value = groupTotal;
      sheet.getCell(`J${rowNumber}`).value = groupQuarterTotals[0];
      sheet.getCell(`K${rowNumber}`).value = groupQuarterTotals[1];
      sheet.getCell(`L${rowNumber}`).value = groupQuarterTotals[2];
      sheet.getCell(`M${rowNumber}`).value = groupQuarterTotals[3];
      rowNumber += 1;

      group.lines.forEach((line, lineIndex) => {
        const quantity = line.quantity && line.quantity > 0 ? line.quantity : 1;
        const unitCost = line.unitCost && line.unitCost > 0
          ? line.unitCost
          : Math.round(line.plannedAmount / Math.max(quantity, 1));
        const title = line.accountTitle ?? line.lineDescription;
        const detail = line.lineDescription === title ? line.comment ?? "" : line.lineDescription;

        sheet.getCell(`C${rowNumber}`).value = `${categoryCode}${lineIndex + 1}`;
        sheet.getCell(`D${rowNumber}`).value = title;
        sheet.getCell(`E${rowNumber}`).value = detail;
        sheet.getCell(`F${rowNumber}`).value = unitCost;
        sheet.getCell(`G${rowNumber}`).value = quantity;
        sheet.getCell(`H${rowNumber}`).value = line.plannedAmount;
        sheet.getCell(`I${rowNumber}`).value = line.unit ?? "";
        sheet.getCell(`J${rowNumber}`).value = line.quarterAmounts[0] ?? 0;
        sheet.getCell(`K${rowNumber}`).value = line.quarterAmounts[1] ?? 0;
        sheet.getCell(`L${rowNumber}`).value = line.quarterAmounts[2] ?? 0;
        sheet.getCell(`M${rowNumber}`).value = line.quarterAmounts[3] ?? 0;
        rowNumber += 1;
      });

      rowNumber += 1;
    });

  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 36;
  sheet.getColumn(5).width = 48;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 12;
  sheet.getColumn(8).width = 14;
  sheet.getColumn(9).width = 12;
  sheet.getColumn(10).width = 12;
  sheet.getColumn(11).width = 12;
  sheet.getColumn(12).width = 12;
  sheet.getColumn(13).width = 12;
  sheet.views = [{ state: "frozen", ySplit: 10 }];
  workbook.addWorksheet("Sheet1");

  return workbook;
}

function renderEifWorkbook(data: ReportingTemplateData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoTRI Project Portal";
  workbook.created = new Date();

  const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
  const depthMap = buildNodeDepthMap(data.nodes);
  const childrenMap = new Map<string | null, CanonicalReportingNode[]>();

  data.nodes.forEach((node) => {
    const key = node.parentId ?? null;
    const siblings = childrenMap.get(key) ?? [];
    siblings.push(node);
    childrenMap.set(key, siblings);
  });

  addWorkbookCover(workbook, "EIF CPD Annex Reporting Package", [
    `Project: ${data.project.name}`,
    `Country: ${data.profile.country ?? "Not specified"}`,
    `Period: ${formatDate(data.profile.reportingStartDate)} to ${formatDate(data.profile.reportingEndDate)}`,
    `Generated annual focus year: ${data.annualYear}`,
  ]);

  if (data.scope === "full-package" || data.scope === "workplan-only") {
    const logframe = workbook.addWorksheet("logframe");
    logframe.addRow(["Country", data.profile.country ?? ""]);
    logframe.addRow(["Period", `${data.years[0]}-${data.years[data.years.length - 1]}`]);
    logframe.addRow([]);
    logframe.addRow([
      "Results chain",
      "Indicator code",
      "Indicator",
      "Baseline",
      "Target",
      "Means of verification",
      "Assumptions",
    ]);
    styleHeaderRow(logframe.getRow(4));

    data.nodes
      .filter((node) => node.type === "outcome" || node.type === "output" || node.type === "activity")
      .forEach((node) => {
        logframe.addRow([
          nodeLabel(node, depthMap.get(node.id) ?? 0),
          node.indicatorCode ?? node.code,
          node.indicatorLabel ?? node.title,
          node.baselineValue ?? "",
          node.targetValue ?? "",
          node.meansOfVerification ?? "",
          node.assumptions ?? "",
        ]);
      });
    autoWidth(logframe);

    const globalPlan = workbook.addWorksheet("Global Work Plan");
    const globalHeaders = [
      "Output / indicator",
      "Activity code",
      "Activity description",
      "Inputs",
      ...data.years.map(String),
      data.profile.fundingFacility1Label ?? "Funding Facility 1",
      data.profile.fundingFacility2Label ?? "Funding Facility 2",
      "EIF funding",
      data.profile.otherFundingLabel ?? "Other sources",
      "Lead entity",
      "Execution rate",
    ];
    globalPlan.addRow(globalHeaders);
    styleHeaderRow(globalPlan.getRow(1));

    data.nodes
      .filter((node) => node.type === "activity" || node.type === "sub_activity")
      .forEach((node) => {
        const nodeLines = linesForNode(data.budgetLines, node.id);
        const parent = node.parentId ? nodeMap.get(node.parentId) : null;
        const annualValues = data.years.map((year) => nodeLines.filter((line) => line.year === year).reduce((sum, line) => sum + line.plannedAmount, 0));
        globalPlan.addRow([
          parent?.title ?? data.project.name,
          node.code,
          node.title,
          nodeLines.map((line) => line.lineDescription).join("; "),
          ...annualValues,
          sumFunding(nodeLines, "ff1", data.template),
          sumFunding(nodeLines, "ff2", data.template),
          sumFunding(nodeLines, "eif", data.template),
          sumFunding(nodeLines, "other", data.template),
          node.leadEntity ?? node.responsibleEntity ?? data.profile.leadAgency ?? data.project.managerName,
          node.executionRate ?? "",
        ]);
      });
    autoWidth(globalPlan);

    const annualPlan = workbook.addWorksheet("Annual Work Plan");
    annualPlan.addRow([
      "Output / indicator",
      "Activity code",
      "Activity description",
      "Inputs",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
      data.profile.fundingFacility1Label ?? "Funding Facility 1",
      data.profile.fundingFacility2Label ?? "Funding Facility 2",
      "EIF funding",
      data.profile.otherFundingLabel ?? "Other sources",
      "Lead entity",
      "Execution rate",
    ]);
    styleHeaderRow(annualPlan.getRow(1));

    data.nodes
      .filter((node) => node.type === "activity" || node.type === "sub_activity")
      .forEach((node) => {
        const nodeLines = linesForNode(data.budgetLines, node.id).filter((line) => line.year === data.annualYear);
        const monthly = Array.from({ length: 12 }, (_, monthIndex) => nodeLines.reduce((sum, line) => sum + (line.monthAmounts[monthIndex] ?? 0), 0));
        const parent = node.parentId ? nodeMap.get(node.parentId) : null;
        annualPlan.addRow([
          parent?.title ?? data.project.name,
          node.code,
          node.title,
          nodeLines.map((line) => line.lineDescription).join("; "),
          ...monthly,
          sumFunding(nodeLines, "ff1", data.template),
          sumFunding(nodeLines, "ff2", data.template),
          sumFunding(nodeLines, "eif", data.template),
          sumFunding(nodeLines, "other", data.template),
          node.leadEntity ?? node.responsibleEntity ?? data.profile.leadAgency ?? data.project.managerName,
          node.executionRate ?? "",
        ]);
      });
    autoWidth(annualPlan);
  }

  if (data.scope === "full-package" || data.scope === "budget-only") {
    const detailed = workbook.addWorksheet("Detailed budget");
    const detailHeaders = [
      "Output / result",
      "Activity code",
      "Description",
      "Input account",
      "Input account title",
      "Input description",
      "FF",
      "Unit",
      ...data.years.flatMap((year) => [`${year} Qty`, `${year} Unit cost`, `${year} Total`]),
    ];
    detailed.addRow(["Country", data.profile.country ?? "", "Start", formatDate(data.profile.reportingStartDate), "End", formatDate(data.profile.reportingEndDate)]);
    detailed.addRow([]);
    detailed.addRow(detailHeaders);
    styleHeaderRow(detailed.getRow(3));

    data.budgetLines.forEach((line) => {
      const node = line.resultId ? nodeMap.get(line.resultId) : null;
      const yearCells = data.years.flatMap((year) => {
        if (year !== line.year) return ["", "", 0];
        return [line.quantity ?? "", line.unitCost ?? "", line.plannedAmount];
      });
      detailed.addRow([
        node?.title ?? data.project.name,
        node?.code ?? "",
        node?.title ?? line.lineDescription,
        line.accountCode ?? "",
        line.accountTitle ?? "",
        line.lineDescription,
        line.fundingFacility,
        line.unit ?? "",
        ...yearCells,
      ]);
    });
    autoWidth(detailed);

    const summary = workbook.addWorksheet("Summary per account");
    summary.addRow([
      "Funding facility",
      "Input account",
      "Input account title",
      ...data.years.map(String),
      "Total",
      "Remarks",
    ]);
    styleHeaderRow(summary.getRow(1));

    const aggregates = new Map<string, { facility: string; code: string; title: string; years: Map<number, number>; total: number }>();
    data.budgetLines.forEach((line) => {
      const facility = line.fundingFacility === "unspecified" ? "eif" : line.fundingFacility;
      const key = `${facility}:${line.accountCode ?? line.accountTitle ?? line.lineDescription}`;
      const current = aggregates.get(key) ?? {
        facility,
        code: line.accountCode ?? "",
        title: line.accountTitle ?? line.lineDescription,
        years: new Map<number, number>(),
        total: 0,
      };
      current.years.set(line.year, (current.years.get(line.year) ?? 0) + line.plannedAmount);
      current.total += line.plannedAmount;
      aggregates.set(key, current);
    });

    aggregates.forEach((entry) => {
      summary.addRow([
        entry.facility,
        entry.code,
        entry.title,
        ...data.years.map((year) => entry.years.get(year) ?? 0),
        entry.total,
        "",
      ]);
    });
    autoWidth(summary);
  }

  return workbook;
}

function renderPpgWorkbook(data: ReportingTemplateData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoTRI Project Portal";
  workbook.created = new Date();

  const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
  const depthMap = buildNodeDepthMap(data.nodes);
  const childrenMap = new Map<string | null, CanonicalReportingNode[]>();

  data.nodes.forEach((node) => {
    const siblings = childrenMap.get(node.parentId ?? null) ?? [];
    siblings.push(node);
    childrenMap.set(node.parentId ?? null, siblings);
  });

  addWorkbookCover(workbook, "PPG BOOST Reporting Workbook", [
    `Project: ${data.project.name}`,
    `Country: ${data.profile.country ?? "Not specified"}`,
    `Lead agency: ${data.profile.leadAgency ?? data.project.managerName}`,
  ]);

  if (data.scope === "full-package" || data.scope === "working-doc") {
    const working = workbook.addWorksheet("PPA BOOST-WORKING DOC");
    working.addRow(["PPA BOOST reporting worksheet"]);
    working.addRow([`Project: ${data.project.name}`]);
    working.addRow([]);
    working.addRow([
      "Code",
      "Description of activities and sub-activities",
      "Category",
      "Planned targets (number)",
      "Unit type",
      "Target groups",
      "Who is responsible for implementation",
      "Budget",
      "Comments",
    ]);
    styleHeaderRow(working.getRow(4));

    data.nodes
      .filter((node) => node.type !== "outcome")
      .forEach((node) => {
        const budgetTotal = sumBudgetForNode(node.id, nodeMap, childrenMap, data.budgetLines);
        working.addRow([
          node.code,
          nodeLabel(node, depthMap.get(node.id) ?? 0),
          node.category ?? (node.type === "output" ? "Output" : "Activity"),
          node.targetValue ?? "",
          node.unitType ?? "",
          node.targetGroup ?? "",
          node.responsibleEntity ?? node.leadEntity ?? data.profile.leadAgency ?? data.project.managerName,
          budgetTotal,
          node.comment ?? "",
        ]);
      });
    autoWidth(working);
  }

  if (data.scope === "full-package" || data.scope === "cost-build-up") {
    const ethiopia = workbook.addWorksheet("PPA BOOST Ethiopia");
    ethiopia.addRow(["No.", "Description", "Category", "Procurement approach and method", "Cost US$", "Comment"]);
    styleHeaderRow(ethiopia.getRow(1));

    data.budgetLines.forEach((line, index) => {
      const node = line.resultId ? nodeMap.get(line.resultId) : null;
      ethiopia.addRow([
        index + 1,
        node ? `${node.code} - ${node.title}` : line.lineDescription,
        line.procurementCategory ?? node?.procurementCategory ?? line.accountTitle ?? "Budget item",
        line.procurementMethod ?? node?.procurementMethod ?? "To be confirmed",
        line.plannedAmount,
        line.comment ?? node?.comment ?? data.profile.procurementNotes ?? "",
      ]);
    });
    autoWidth(ethiopia);
  }

  return workbook;
}

export async function renderReportingTemplateExcel(data: ReportingTemplateData): Promise<Buffer> {
  const workbook = data.template === "agra-budget-breakdown"
    ? renderAgraWorkbook(data)
    : data.template === "eif-cpd-annex"
      ? renderEifWorkbook(data)
      : renderPpgWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildReportingTemplateFilename(data: ReportingTemplateData): string {
  const safeProjectName = data.project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const templateSegment = data.template === "agra-budget-breakdown"
    ? "agra-budget-breakdown"
    : data.template === "eif-cpd-annex"
      ? "eif-cpd-annex"
      : "ppg-boost";
  return `${templateSegment}-${safeProjectName}-${data.annualYear}.xlsx`;
}
