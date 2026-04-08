import "server-only";

// `exceljs` is already used elsewhere in the app at runtime, but this project
// does not currently have full module typings available for it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require("exceljs") as { Workbook: new () => ExcelWorkbookLike };

type ExcelCellLike = {
  value: unknown;
};

type ExcelRowLike = {
  getCell: (column: string | number) => ExcelCellLike;
};

type ExcelSheetLike = {
  name: string;
  rowCount: number;
  columnCount: number;
  getCell: (address: string) => ExcelCellLike;
  getRow: (rowNumber: number) => ExcelRowLike;
};

type ExcelWorkbookLike = {
  xlsx: {
    load: (buffer: Buffer) => Promise<void>;
  };
  worksheets: ExcelSheetLike[];
  getWorksheet: (name: string) => ExcelSheetLike | undefined;
};

type ParsedBudgetAllocation = {
  activityName: string;
  plannedAmount: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  notes: string | null;
};

type ReportingTemplateValue = "agra_budget_breakdown" | "eif_cpd_annex" | "ppg_boost";
type ImportTemplateId = "agra-wrf-budget-detail" | "eif-cpd-annex" | "ppg-boost-workbook";

type ParsedReportingDefaults = {
  primaryTemplate: ReportingTemplateValue;
  country: string | null;
  currency: "ETB" | "USD" | "EUR";
  reportingStartDate: Date | null;
  reportingEndDate: Date | null;
  annualYear: number | null;
  fundingFacility1Label: string | null;
  fundingFacility2Label: string | null;
  otherFundingLabel: string | null;
  leadAgency: string | null;
  implementingPartner: string | null;
  procurementNotes: string | null;
};

export type ParsedProjectImport = {
  name: string;
  description: string | null;
  totalBudget: number;
  budgetYear: number | null;
  sourceSheet: string;
  templateId: ImportTemplateId;
  templateLabel: string;
  reportingDefaults: ParsedReportingDefaults;
  allocations: ParsedBudgetAllocation[];
};

type RowContext = {
  currentCategoryCode: string | null;
  currentCategoryName: string | null;
  currentActivityCode: string | null;
  currentActivityName: string | null;
};

type QuarterValues = {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
};

type YearlyTotal = {
  year: number;
  plannedAmount: number;
  quantity: number | null;
  unitCost: number | null;
};

type WorkingSheetRow = {
  code: string | null;
  title: string;
  category: string | null;
  targetValue: number | null;
  unitType: string | null;
  targetGroup: string | null;
  responsibleEntity: string | null;
  comment: string | null;
};

type ParsedAccountCell = {
  accountCode: string | null;
  accountTitle: string | null;
};

function getWorksheetByNormalizedName(workbook: ExcelWorkbookLike, targetName: string): ExcelSheetLike | undefined {
  const exactMatch = workbook.getWorksheet(targetName);
  if (exactMatch) return exactMatch;

  const normalizedTarget = targetName.trim().toLowerCase();
  return workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === normalizedTarget);
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText
      .map((chunk) => (chunk && typeof chunk === "object" && "text" in chunk ? String(chunk.text ?? "") : ""))
      .join("")
      .trim();
  }
  if (typeof value === "object" && "result" in value && value.result !== null && value.result !== undefined) {
    return normalizeText(value.result);
  }
  return String(value).trim();
}

function getNumericCellValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && "result" in value && typeof value.result === "number" && Number.isFinite(value.result)) {
    return value.result;
  }
  const normalized = normalizeText(value).replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFormulaText(value: unknown): string | null {
  if (value && typeof value === "object" && "formula" in value && typeof value.formula === "string") {
    return value.formula.toUpperCase();
  }
  return null;
}

function getDateCellValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildEvenQuarterSplit(totalCost: number) {
  const roundedTotal = Math.round(totalCost);
  const base = Math.floor(roundedTotal / 4);
  let remainder = roundedTotal - base * 4;
  const values = Array.from({ length: 4 }, () => {
    const amount = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return amount;
  });

  return {
    plannedAmount: roundedTotal,
    q1: values[0] ?? 0,
    q2: values[1] ?? 0,
    q3: values[2] ?? 0,
    q4: values[3] ?? 0,
  };
}

function roundQuarterSplit(totalCost: number, quarterValues: QuarterValues) {
  const roundedTotal = Math.round(totalCost);
  const roundedQuarters = [
    Math.round(quarterValues.q1 ?? 0),
    Math.round(quarterValues.q2 ?? 0),
    Math.round(quarterValues.q3 ?? 0),
    Math.round(quarterValues.q4 ?? 0),
  ];
  const rawSum = roundedQuarters.reduce((sum, value) => sum + value, 0);

  if (rawSum <= 0) {
    return buildEvenQuarterSplit(totalCost);
  }

  const scaled = roundedQuarters.map((value, index) => {
    if (index === roundedQuarters.length - 1) return 0;
    return Math.round((value / rawSum) * roundedTotal);
  });
  const assigned = scaled.reduce((sum, value) => sum + value, 0);

  return {
    plannedAmount: roundedTotal,
    q1: scaled[0] ?? 0,
    q2: scaled[1] ?? 0,
    q3: scaled[2] ?? 0,
    q4: Math.max(0, roundedTotal - assigned),
  };
}

function isCategoryCode(code: string): boolean {
  return /^[A-Z]+$/.test(code);
}

function isActivityCode(code: string): boolean {
  return /^[A-Z]+\d+(\.\d+)*$/.test(code);
}

function isObjectiveHeader(name: string): boolean {
  return /^OBJECTIVE\s+\d+/i.test(name);
}

function buildAllocationName(context: RowContext, rowCode: string | null, rowName: string): string {
  if (rowCode) return `${rowCode} - ${rowName}`;
  if (context.currentActivityCode && context.currentActivityName) {
    return `${context.currentActivityCode} / ${rowName}`;
  }
  if (context.currentCategoryCode && context.currentCategoryName) {
    return `${context.currentCategoryCode} / ${rowName}`;
  }
  return rowName;
}

function cleanFileName(fileName?: string | null): string {
  const raw = (fileName ?? "").replace(/\.xlsx$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return raw || "Imported workbook";
}

function extractYearFromText(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function normalizeLookupKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAccountCell(rawValue: string | null): ParsedAccountCell {
  const raw = (rawValue ?? "").trim();
  if (!raw) return { accountCode: null, accountTitle: null };

  const match = raw.match(/^([A-Za-z0-9.]+)\s*[-–]?\s*(.*)$/);
  if (!match) return { accountCode: null, accountTitle: raw };

  const [, accountCode, title] = match;
  if (!title.trim()) {
    return { accountCode: accountCode || null, accountTitle: null };
  }

  return {
    accountCode: accountCode || null,
    accountTitle: title.trim() || null,
  };
}

function extractEifOutputCode(activityCode: string | null): string | null {
  if (!activityCode) return null;
  const match = activityCode.match(/^(OP\d+(?:\.\d+)?)/i);
  return match ? match[1].toUpperCase() : null;
}

function stripEifOutputLabel(outputLabel: string): string {
  return outputLabel.replace(/^Output\s+\d+(?:\.\d+)?\s*[-–:]\s*/i, "").trim() || outputLabel.trim();
}

function buildDefaultReportingDates(year: number | null): { reportingStartDate: Date | null; reportingEndDate: Date | null } {
  if (!year) {
    return { reportingStartDate: null, reportingEndDate: null };
  }

  return {
    reportingStartDate: new Date(`${year}-01-01T00:00:00.000Z`),
    reportingEndDate: new Date(`${year}-12-31T00:00:00.000Z`),
  };
}

function parseAgraBudgetWorkbook(workbook: ExcelWorkbookLike, fallbackName: string): ParsedProjectImport | null {
  const sheet = workbook.getWorksheet("WRF Budget detail") ?? workbook.worksheets[0];
  if (!sheet) {
    return null;
  }

  const titleCell = normalizeText(sheet.getCell("B5").value);
  const accountHeader = normalizeText(sheet.getCell("C8").value);
  const descriptionHeader = normalizeText(sheet.getCell("D8").value);
  const totalHeader = normalizeText(sheet.getCell("H8").value);

  if (!titleCell.toLowerCase().includes("project title") || accountHeader !== "Account" || descriptionHeader !== "Description" || totalHeader !== "Total cost") {
    return null;
  }

  const projectName = titleCell.replace(/^Project Title:\s*/i, "").trim() || fallbackName;
  const budgetYear = getNumericCellValue(sheet.getCell("F7").value);
  const context: RowContext = {
    currentCategoryCode: null,
    currentCategoryName: null,
    currentActivityCode: null,
    currentActivityName: null,
  };

  const allocations: ParsedBudgetAllocation[] = [];

  for (let rowNumber = 12; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const code = normalizeText(row.getCell("C").value) || null;
    const name = normalizeText(row.getCell("D").value);
    const description = normalizeText(row.getCell("E").value) || null;
    const unitCost = getNumericCellValue(row.getCell("F").value);
    const unitCount = getNumericCellValue(row.getCell("G").value);
    const totalCost = getNumericCellValue(row.getCell("H").value);
    const formula = getFormulaText(row.getCell("H").value);
    const unitType = normalizeText(row.getCell("I").value) || null;
    const quarterValues: QuarterValues = {
      q1: getNumericCellValue(row.getCell("J").value),
      q2: getNumericCellValue(row.getCell("K").value),
      q3: getNumericCellValue(row.getCell("L").value),
      q4: getNumericCellValue(row.getCell("M").value),
    };

    if (!code && !name) continue;
    if (name === "TOTAL DIRECT COSTS") break;

    if ((code && isCategoryCode(code)) || isObjectiveHeader(name)) {
      context.currentCategoryCode = code;
      context.currentCategoryName = name;
      context.currentActivityCode = null;
      context.currentActivityName = null;
      continue;
    }

    if (code && isActivityCode(code)) {
      context.currentActivityCode = code;
      context.currentActivityName = name;
    } else if (!code && !formula && !unitCost && !unitCount && !totalCost) {
      context.currentActivityCode = null;
      context.currentActivityName = null;
    }

    if (!name || totalCost === null || totalCost <= 0) continue;
    if (formula && (formula.includes("SUM(") || /^H\d+/.test(formula) || formula.includes("+H"))) continue;

    const roundedAllocation = roundQuarterSplit(totalCost, quarterValues);
    const yearlyTotals = budgetYear
      ? [{
          year: Math.round(budgetYear),
          plannedAmount: roundedAllocation.plannedAmount,
          quantity: unitCount ? Math.round(unitCount) : null,
          unitCost: unitCost ? Math.round(unitCost) : null,
        }]
      : [];

    const activityName = buildAllocationName(context, code && isActivityCode(code) ? code : null, name);
    const notes = JSON.stringify({
      template: "AGRA_WRF_BUDGET_DETAIL",
      sourceSheet: sheet.name,
      sourceRow: rowNumber,
      rowCode: code,
      accountCode: code,
      accountTitle: name,
      categoryCode: context.currentCategoryCode,
      categoryName: context.currentCategoryName,
      parentActivityCode: code && isActivityCode(code) ? code : context.currentActivityCode,
      parentActivityName: code && isActivityCode(code) ? name : context.currentActivityName,
      description,
      unitCost,
      unitCount,
      unitType,
      year: budgetYear ? Math.round(budgetYear) : null,
      yearlyTotals,
      quarters: quarterValues,
      rawTotalCost: totalCost,
    });

    allocations.push({
      activityName,
      plannedAmount: roundedAllocation.plannedAmount,
      q1: roundedAllocation.q1,
      q2: roundedAllocation.q2,
      q3: roundedAllocation.q3,
      q4: roundedAllocation.q4,
      notes,
    });
  }

  if (allocations.length === 0) {
    throw new Error("No importable budget lines were found in the workbook");
  }

  const roundedBudgetYear = budgetYear ? Math.round(budgetYear) : null;
  const totalBudget = allocations.reduce((sum, allocation) => sum + allocation.plannedAmount, 0);
  const description = roundedBudgetYear
    ? `Imported from AGRA budget breakdown workbook for ${roundedBudgetYear}.`
    : "Imported from AGRA budget breakdown workbook.";
  const defaultDates = buildDefaultReportingDates(roundedBudgetYear);

  return {
    name: projectName,
    description,
    totalBudget,
    budgetYear: roundedBudgetYear,
    sourceSheet: sheet.name,
    templateId: "agra-wrf-budget-detail",
    templateLabel: "AGRA Budget Breakdown",
    reportingDefaults: {
      primaryTemplate: "agra_budget_breakdown",
      country: null,
      currency: "ETB",
      reportingStartDate: defaultDates.reportingStartDate,
      reportingEndDate: defaultDates.reportingEndDate,
      annualYear: roundedBudgetYear,
      fundingFacility1Label: null,
      fundingFacility2Label: null,
      otherFundingLabel: null,
      leadAgency: null,
      implementingPartner: null,
      procurementNotes: null,
    },
    allocations,
  };
}

function buildPpgWorkingLookup(sheet: ExcelSheetLike): { year: number | null; byDescription: Map<string, WorkingSheetRow> } {
  const byDescription = new Map<string, WorkingSheetRow>();
  let year: number | null = null;

  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 6); rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
      const extractedYear = extractYearFromText(normalizeText(sheet.getRow(rowNumber).getCell(columnNumber).value));
      if (extractedYear) {
        year = extractedYear;
        break;
      }
    }
    if (year) break;
  }

  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const title = normalizeText(row.getCell(3).value);
    if (!title) continue;

    const entry: WorkingSheetRow = {
      code: normalizeText(row.getCell(2).value) || null,
      title,
      category: normalizeText(row.getCell(4).value) || null,
      targetValue: getNumericCellValue(row.getCell(5).value),
      unitType: normalizeText(row.getCell(6).value) || null,
      targetGroup: normalizeText(row.getCell(7).value) || null,
      responsibleEntity: normalizeText(row.getCell(8).value) || null,
      comment: normalizeText(row.getCell(10).value) || null,
    };

    const key = normalizeLookupKey(title);
    if (key && !byDescription.has(key)) {
      byDescription.set(key, entry);
    }
  }

  return { year, byDescription };
}

function parsePpgBoostWorkbook(workbook: ExcelWorkbookLike, fallbackName: string): ParsedProjectImport | null {
  const workingSheet = workbook.getWorksheet("PPA BOOST-WORKING DOC");
  const ethiopiaSheet = workbook.getWorksheet("PPA BOOST Ethiopia");

  if (!workingSheet || !ethiopiaSheet) {
    return null;
  }

  const { year, byDescription } = buildPpgWorkingLookup(workingSheet);
  const allocations: ParsedBudgetAllocation[] = [];
  let currentSectionCode: string | null = null;
  let currentSectionName: string | null = null;

  for (let rowNumber = 2; rowNumber <= ethiopiaSheet.rowCount; rowNumber += 1) {
    const row = ethiopiaSheet.getRow(rowNumber);
    const rawNo = normalizeText(row.getCell(1).value);
    const description = normalizeText(row.getCell(2).value);
    const procurementCategory = normalizeText(row.getCell(3).value) || null;
    const procurementMethod = normalizeText(row.getCell(4).value) || null;
    const totalCost = getNumericCellValue(row.getCell(5).value);
    const comment = normalizeText(row.getCell(6).value) || null;
    const formula = getFormulaText(row.getCell(5).value);

    if (!rawNo && !description) continue;

    if (rawNo.endsWith(".") && description) {
      currentSectionCode = rawNo.replace(/\.+$/, "") || null;
      currentSectionName = description;
      continue;
    }

    if (formula || totalCost === null || totalCost <= 0 || !description) continue;

    const roundedAllocation = buildEvenQuarterSplit(totalCost);
    const lookup = byDescription.get(normalizeLookupKey(description));
    const rowCode = lookup?.code || (currentSectionCode ? `${currentSectionCode}.${rawNo}` : rawNo || null);
    const yearlyTotals = year
      ? [{
          year,
          plannedAmount: roundedAllocation.plannedAmount,
          quantity: lookup?.targetValue ? Math.round(lookup.targetValue) : null,
          unitCost: null,
        }]
      : [];

    const notes = JSON.stringify({
      template: "PPG_BOOST_ETHIOPIA",
      sourceSheet: ethiopiaSheet.name,
      sourceRow: rowNumber,
      rowCode,
      accountCode: rowCode,
      accountTitle: procurementCategory ?? currentSectionName,
      categoryCode: currentSectionCode,
      categoryName: currentSectionName,
      parentActivityCode: lookup?.code ?? rowCode,
      parentActivityName: lookup?.title ?? description,
      description: comment,
      unitCost: null,
      unitCount: lookup?.targetValue ?? null,
      unitType: lookup?.unitType ?? null,
      targetGroup: lookup?.targetGroup ?? null,
      responsibleEntity: lookup?.responsibleEntity ?? null,
      leadEntity: lookup?.responsibleEntity ?? null,
      procurementCategory,
      procurementMethod,
      comment: comment ?? lookup?.comment ?? null,
      year,
      yearlyTotals,
      rawTotalCost: totalCost,
    });

    allocations.push({
      activityName: description,
      plannedAmount: roundedAllocation.plannedAmount,
      q1: roundedAllocation.q1,
      q2: roundedAllocation.q2,
      q3: roundedAllocation.q3,
      q4: roundedAllocation.q4,
      notes,
    });
  }

  if (allocations.length === 0) {
    throw new Error("No importable budget lines were found in the PPG BOOST workbook");
  }

  const totalBudget = allocations.reduce((sum, allocation) => sum + allocation.plannedAmount, 0);
  const roundedYear = year ? Math.round(year) : null;
  const defaultDates = buildDefaultReportingDates(roundedYear);

  return {
    name: fallbackName,
    description: roundedYear
      ? `Imported from PPG BOOST workbook for ${roundedYear}.`
      : "Imported from PPG BOOST workbook.",
    totalBudget,
    budgetYear: roundedYear,
    sourceSheet: ethiopiaSheet.name,
    templateId: "ppg-boost-workbook",
    templateLabel: "PPG BOOST Workbook",
    reportingDefaults: {
      primaryTemplate: "ppg_boost",
      country: "Ethiopia",
      currency: "USD",
      reportingStartDate: defaultDates.reportingStartDate,
      reportingEndDate: defaultDates.reportingEndDate,
      annualYear: roundedYear,
      fundingFacility1Label: null,
      fundingFacility2Label: null,
      otherFundingLabel: null,
      leadAgency: null,
      implementingPartner: null,
      procurementNotes: null,
    },
    allocations,
  };
}

function detectEifYearColumns(sheet: ExcelSheetLike): Array<{ year: number; quantityCol: number; unitCostCol: number; totalCol: number }> {
  const yearColumns: Array<{ year: number; quantityCol: number; unitCostCol: number; totalCol: number }> = [];
  const yearHeaderRow = sheet.getRow(5);

  for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
    const yearValue = getNumericCellValue(yearHeaderRow.getCell(columnNumber).value);
    if (!yearValue || yearValue < 2000 || yearValue > 2100) continue;

    yearColumns.push({
      year: Math.round(yearValue),
      quantityCol: Math.max(1, columnNumber - 1),
      unitCostCol: columnNumber,
      totalCol: columnNumber + 1,
    });
  }

  return yearColumns;
}

function parseEifAnnexWorkbook(workbook: ExcelWorkbookLike, fallbackName: string): ParsedProjectImport | null {
  const sheet = getWorksheetByNormalizedName(workbook, "Detailed budget");
  if (!sheet) return null;

  const title = normalizeText(sheet.getCell("B1").value);
  if (!title.toLowerCase().includes("detailed budget template")) {
    return null;
  }

  const country = normalizeText(sheet.getCell("C2").value) || null;
  const reportingStartDate = getDateCellValue(sheet.getCell("C3").value);
  const reportingEndDate = getDateCellValue(sheet.getCell("C4").value);
  const yearColumns = detectEifYearColumns(sheet);
  const budgetYear = yearColumns[0]?.year ?? (reportingStartDate ? reportingStartDate.getFullYear() : null);
  const allocations: ParsedBudgetAllocation[] = [];
  let currentOutputTitle: string | null = null;

  for (let rowNumber = 7; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const outputLabel = normalizeText(row.getCell(1).value);
    const activityCode = normalizeText(row.getCell(2).value) || null;
    const activityDescription = normalizeText(row.getCell(3).value);
    const inputAccountRaw = normalizeText(row.getCell(4).value) || null;
    const inputDescription = normalizeText(row.getCell(5).value) || null;
    const fundingFacilityRaw = normalizeText(row.getCell(6).value) || null;
    const unitType = normalizeText(row.getCell(7).value) || null;

    if (outputLabel && /^Output\s+/i.test(outputLabel)) {
      currentOutputTitle = stripEifOutputLabel(outputLabel);
    }

    if (outputLabel && /^Subtotal/i.test(outputLabel)) {
      continue;
    }

    if (!activityCode || !activityDescription) {
      continue;
    }

    const yearlyTotals = yearColumns
      .map((entry) => {
        const plannedAmount = getNumericCellValue(row.getCell(entry.totalCol).value);
        if (!plannedAmount || plannedAmount <= 0) return null;

        return {
          year: entry.year,
          plannedAmount: Math.round(plannedAmount),
          quantity: (() => {
            const value = getNumericCellValue(row.getCell(entry.quantityCol).value);
            return value ? Math.round(value) : null;
          })(),
          unitCost: (() => {
            const value = getNumericCellValue(row.getCell(entry.unitCostCol).value);
            return value ? Math.round(value) : null;
          })(),
        } satisfies YearlyTotal;
      })
      .filter((value): value is YearlyTotal => Boolean(value));

    if (yearlyTotals.length === 0) continue;

    const totalCost = yearlyTotals.reduce((sum, entry) => sum + entry.plannedAmount, 0);
    const roundedAllocation = buildEvenQuarterSplit(totalCost);
    const outputCode = extractEifOutputCode(activityCode);
    const parsedAccount = parseAccountCell(inputAccountRaw);
    const description = inputDescription || activityDescription;
    const quantityTotal = yearlyTotals.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
    const firstUnitCost = yearlyTotals.find((entry) => entry.unitCost !== null)?.unitCost ?? null;

    const notes = JSON.stringify({
      template: "EIF_CPD_ANNEX",
      sourceSheet: sheet.name,
      sourceRow: rowNumber,
      rowCode: parsedAccount.accountCode ?? activityCode,
      accountCode: parsedAccount.accountCode,
      accountTitle: parsedAccount.accountTitle,
      categoryCode: outputCode,
      categoryName: currentOutputTitle,
      parentActivityCode: activityCode,
      parentActivityName: activityDescription,
      description,
      unitCost: firstUnitCost,
      unitCount: quantityTotal > 0 ? quantityTotal : null,
      unitType,
      fundingFacility: fundingFacilityRaw,
      year: budgetYear,
      yearlyTotals,
      rawTotalCost: totalCost,
    });

    allocations.push({
      activityName: inputDescription ? `${activityDescription} / ${inputDescription}` : `${activityCode} - ${activityDescription}`,
      plannedAmount: roundedAllocation.plannedAmount,
      q1: roundedAllocation.q1,
      q2: roundedAllocation.q2,
      q3: roundedAllocation.q3,
      q4: roundedAllocation.q4,
      notes,
    });
  }

  if (allocations.length === 0) {
    throw new Error("No importable budget lines were found in the EIF CPD Annex workbook");
  }

  const totalBudget = allocations.reduce((sum, allocation) => sum + allocation.plannedAmount, 0);

  return {
    name: fallbackName,
    description: budgetYear
      ? `Imported from EIF CPD Annex workbook for ${budgetYear}.`
      : "Imported from EIF CPD Annex workbook.",
    totalBudget,
    budgetYear,
    sourceSheet: sheet.name,
    templateId: "eif-cpd-annex",
    templateLabel: "EIF CPD Annex",
    reportingDefaults: {
      primaryTemplate: "eif_cpd_annex",
      country,
      currency: "ETB",
      reportingStartDate,
      reportingEndDate,
      annualYear: budgetYear,
      fundingFacility1Label: "Funding Facility 1",
      fundingFacility2Label: "Funding Facility 2",
      otherFundingLabel: "Other sources",
      leadAgency: null,
      implementingPartner: null,
      procurementNotes: null,
    },
    allocations,
  };
}

export async function parseProjectBudgetWorkbook(buffer: Buffer, fileName?: string): Promise<ParsedProjectImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (workbook.worksheets.length === 0) {
    throw new Error("Workbook does not contain a usable worksheet");
  }

  const fallbackName = cleanFileName(fileName);

  const agra = parseAgraBudgetWorkbook(workbook, fallbackName);
  if (agra) return agra;

  const ppg = parsePpgBoostWorkbook(workbook, fallbackName);
  if (ppg) return ppg;

  const eif = parseEifAnnexWorkbook(workbook, fallbackName);
  if (eif) return eif;

  throw new Error("Unsupported workbook format. Expected an AGRA, EIF CPD Annex, or PPG BOOST template.");
}
