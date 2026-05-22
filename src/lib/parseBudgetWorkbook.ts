import * as XLSX from "xlsx";
import { EditableBudgetRow, createRow } from "./budgetModel";

export type BudgetRowType = "income" | "expense" | "balance";

export interface BudgetRow {
  id: string;
  section: string;
  name: string;
  planned: number;
  actual: number;
  difference: number;
  type: BudgetRowType;
  isSubtotal: boolean;
}

export interface CategorySummary {
  name: string;
  planned: number;
  actual: number;
  difference: number;
  rows: BudgetRow[];
  type: BudgetRowType;
}

export interface BudgetWorkbookData {
  workbookName: string;
  sheetName: string;
  rows: BudgetRow[];
  categories: CategorySummary[];
  incomeRows: BudgetRow[];
  expenseRows: BudgetRow[];
  totals: {
    totalIncome: number;
    plannedExpenses: number;
    actualExpenses: number;
    budgetBalance: number;
    plannedVsActualDifference: number;
  };
}

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRow = CellValue[];

const SECTION_TYPES: Record<string, BudgetRowType> = {
  income: "income",
  "budget balance": "balance",
};

const IGNORED_LABELS = new Set(["planned", "actual", "diff.", "get started", "note"]);

const TABLE_ZONES = [
  { label: 1, planned: 3, actual: 4, difference: 5 },
  { label: 7, planned: 9, actual: 10, difference: 11 },
];

export async function parseBudgetWorkbookFromUrl(workbookUrl: string): Promise<BudgetWorkbookData> {
  const response = await fetch(workbookUrl);

  if (!response.ok) {
    throw new Error(`Unable to load workbook (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return parseBudgetWorkbookFromArrayBuffer(buffer, getWorkbookNameFromUrl(workbookUrl));
}

export function parseBudgetWorkbookFromArrayBuffer(buffer: ArrayBuffer, workbookName: string): BudgetWorkbookData {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.includes("Summary") ? "Summary" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("The workbook does not contain a readable Summary sheet.");
  }

  const sheetRows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  const rows = extractBudgetRows(sheetRows);
  const categories = summarizeCategories(rows);
  const incomeRows = rows.filter((row) => row.type === "income" && !row.isSubtotal);
  const expenseRows = rows.filter((row) => row.type === "expense" && !row.isSubtotal);
  const subtotalRows = rows.filter((row) => row.isSubtotal);

  const totalIncome = findNamedRow(rows, "total income")?.actual ?? sumRows(incomeRows, "actual");
  const plannedExpenses = sumRows(subtotalRows.filter((row) => row.type === "expense"), "planned");
  const actualExpenses = sumRows(subtotalRows.filter((row) => row.type === "expense"), "actual");
  const budgetBalance =
    findNamedRow(rows, "total budget balance")?.actual ?? totalIncome - actualExpenses;
  const plannedVsActualDifference = plannedExpenses - actualExpenses;

  return {
    workbookName,
    sheetName,
    rows,
    categories,
    incomeRows,
    expenseRows,
    totals: {
      totalIncome,
      plannedExpenses,
      actualExpenses,
      budgetBalance,
      plannedVsActualDifference,
    },
  };
}

export function isSubtotalLabel(label: string) {
  const normalized = label.toLowerCase().trim();
  return normalized === "subtotal" || normalized === "total income" || normalized === "total budget balance";
}

export function convertWorkbookRowsToEditableRows(rows: BudgetRow[]): EditableBudgetRow[] {
  return rows
    .filter((row) => !row.isSubtotal && row.type !== "balance")
    .map((row) =>
      createRow({
        id: row.id,
        type: row.type === "income" ? "income" : "expense",
        category: row.section,
        name: row.name,
        planned: row.planned,
        actual: row.actual,
      }),
    );
}

function extractBudgetRows(sheetRows: SheetRow[]): BudgetRow[] {
  const budgetRows: BudgetRow[] = [];

  TABLE_ZONES.forEach((zone, zoneIndex) => {
    let currentSection = "";
    let currentType: BudgetRowType = "expense";

    sheetRows.forEach((sheetRow, rowIndex) => {
      const label = cleanLabel(sheetRow[zone.label]);
      const plannedLabel = cleanLabel(sheetRow[zone.planned]);
      const actualLabel = cleanLabel(sheetRow[zone.actual]);
      const diffLabel = cleanLabel(sheetRow[zone.difference]);

      if (!label || IGNORED_LABELS.has(label.toLowerCase())) {
        return;
      }

      const hasMoneyCells = [plannedLabel, actualLabel, diffLabel].some((value) => value !== "");
      const looksLikeSection =
        !hasMoneyCells ||
        (plannedLabel.toLowerCase() === "planned" &&
          actualLabel.toLowerCase() === "actual" &&
          diffLabel.toLowerCase() === "diff.");

      if (looksLikeSection && label.toLowerCase() !== "subtotal") {
        currentSection = label;
        currentType = SECTION_TYPES[label.toLowerCase()] ?? "expense";
        return;
      }

      if (!currentSection) {
        return;
      }

      const planned = parseCurrency(sheetRow[zone.planned]);
      const actual = parseCurrency(sheetRow[zone.actual]);
      const parsedDifference = parseCurrency(sheetRow[zone.difference]);
      const difference = parsedDifference || planned - actual;

      budgetRows.push({
        id: `${zoneIndex}-${rowIndex}-${slugify(currentSection)}-${slugify(label)}`,
        section: currentSection,
        name: label,
        planned,
        actual,
        difference,
        type: currentType,
        isSubtotal: isSubtotalLabel(label),
      });
    });
  });

  return budgetRows;
}

function summarizeCategories(rows: BudgetRow[]): CategorySummary[] {
  const grouped = new Map<string, BudgetRow[]>();

  rows
    .filter((row) => row.type !== "balance")
    .forEach((row) => {
      const collection = grouped.get(row.section) ?? [];
      collection.push(row);
      grouped.set(row.section, collection);
    });

  return Array.from(grouped.entries()).map(([name, categoryRows]) => {
    const subtotal = categoryRows.find((row) => row.isSubtotal);
    const itemRows = categoryRows.filter((row) => !row.isSubtotal);

    return {
      name,
      type: categoryRows[0]?.type ?? "expense",
      planned: subtotal?.planned ?? sumRows(itemRows, "planned"),
      actual: subtotal?.actual ?? sumRows(itemRows, "actual"),
      difference: subtotal?.difference ?? sumRows(itemRows, "difference"),
      rows: itemRows,
    };
  });
}

function findNamedRow(rows: BudgetRow[], name: string) {
  return rows.find((row) => row.name.toLowerCase() === name);
}

function sumRows(rows: BudgetRow[], key: "planned" | "actual" | "difference") {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function cleanLabel(value: CellValue) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCurrency(value: CellValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const cleaned = String(value ?? "")
    .replace(/[,$\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getWorkbookNameFromUrl(workbookUrl: string) {
  const filename = workbookUrl.split("/").pop()?.replace(/\.[^.]+$/, "");
  return filename ? filename.replace(/[-_]+/g, " ") : "Sample workbook";
}
