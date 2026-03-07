import "server-only";

// `exceljs` is already used elsewhere in the app at runtime, but this project
// does not currently have full module typings available for it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require("exceljs") as { Workbook: new () => ExcelWorkbookLike };

type ExcelCellLike = {
  value: unknown;
};

type ExcelRowLike = {
  getCell: (column: string) => ExcelCellLike;
};

type ExcelSheetLike = {
  name: string;
  rowCount: number;
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

export type ParsedProjectImport = {
  name: string;
  description: string | null;
  totalBudget: number;
  budgetYear: number | null;
  sourceSheet: string;
  allocations: ParsedBudgetAllocation[];
};

type RowContext = {
  currentCategoryCode: string | null;
  currentCategoryName: string | null;
  currentActivityCode: string | null;
  currentActivityName: string | null;
};

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
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

function roundQuarterSplit(totalCost: number, quarterValues: { q1: number | null; q2: number | null; q3: number | null; q4: number | null }) {
  const roundedTotal = Math.round(totalCost);
  const roundedQuarters = [
    Math.round(quarterValues.q1 ?? 0),
    Math.round(quarterValues.q2 ?? 0),
    Math.round(quarterValues.q3 ?? 0),
    Math.round(quarterValues.q4 ?? 0),
  ];

  let difference = roundedTotal - roundedQuarters.reduce((sum, value) => sum + value, 0);

  if (difference > 0) {
    roundedQuarters[3] += difference;
    difference = 0;
  } else if (difference < 0) {
    let remaining = -difference;

    for (let index = roundedQuarters.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const adjustment = Math.min(roundedQuarters[index], remaining);
      roundedQuarters[index] -= adjustment;
      remaining -= adjustment;
    }

    difference = -remaining;
  }

  return {
    plannedAmount: roundedTotal,
    q1: roundedQuarters[0],
    q2: roundedQuarters[1],
    q3: roundedQuarters[2],
    q4: roundedQuarters[3],
  };
}

export async function parseAgraBudgetWorkbook(buffer: Buffer): Promise<ParsedProjectImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet("WRF Budget detail") ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Workbook does not contain a usable worksheet");
  }

  const titleCell = normalizeText(sheet.getCell("B5").value);
  const accountHeader = normalizeText(sheet.getCell("C8").value);
  const descriptionHeader = normalizeText(sheet.getCell("D8").value);
  const totalHeader = normalizeText(sheet.getCell("H8").value);

  if (!titleCell.toLowerCase().includes("project title") || accountHeader !== "Account" || descriptionHeader !== "Description" || totalHeader !== "Total cost") {
    throw new Error("Unsupported workbook format. Expected AGRA WRF budget template.");
  }

  const projectName = titleCell.replace(/^Project Title:\s*/i, "").trim();
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
    const quarterValues = {
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

    const activityName = buildAllocationName(context, code && isActivityCode(code) ? code : null, name);
    const notes = JSON.stringify({
      template: "AGRA_WRF_BUDGET_DETAIL",
      sourceSheet: sheet.name,
      sourceRow: rowNumber,
      rowCode: code,
      categoryCode: context.currentCategoryCode,
      categoryName: context.currentCategoryName,
      parentActivityCode: code && isActivityCode(code) ? code : context.currentActivityCode,
      parentActivityName: code && isActivityCode(code) ? name : context.currentActivityName,
      description,
      unitCost,
      unitCount,
      quarters: quarterValues,
      rawTotalCost: totalCost,
    });

    const roundedAllocation = roundQuarterSplit(totalCost, quarterValues);

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

  const totalBudget = allocations.reduce((sum, allocation) => sum + allocation.plannedAmount, 0);
  const description = budgetYear
    ? `Imported from AGRA WRF budget template for ${budgetYear}.`
    : "Imported from AGRA WRF budget template.";

  return {
    name: projectName,
    description,
    totalBudget,
    budgetYear: budgetYear ? Math.round(budgetYear) : null,
    sourceSheet: sheet.name,
    allocations,
  };
}
