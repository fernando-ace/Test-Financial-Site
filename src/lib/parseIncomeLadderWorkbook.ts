import * as XLSX from "xlsx";

export interface MonthlyCashFlowRow {
  month: string;
  label: string;
  year: number;
  spendingGoal: number;
  totalNetIncome: number;
  cmaWithdrawals: number;
  iraDistributions: number;
  surplusDeficit: number;
}

export interface AnnualCashFlowSummary {
  year: number;
  spendingGoal: number;
  totalNetIncome: number;
  cmaWithdrawals: number;
  iraDistributions: number;
  surplusDeficit: number;
}

export interface MaturityEvent {
  month: string;
  label: string;
  account: "Client 1 IRA" | "Client 2 IRA" | "CMA";
  maturingAmount: number;
  cashBalance?: number;
  distributionOrWithdrawal?: number;
}

export interface IncomeLadderReport {
  workbookName: string;
  sheetName: string;
  rowsParsed: number;
  monthlyRows: MonthlyCashFlowRow[];
  annualSummary: AnnualCashFlowSummary[];
  maturityEvents: MaturityEvent[];
  beginningValues: {
    client1Ira?: number;
    client2Ira?: number;
    cma?: number;
  };
  metrics: {
    firstMonth?: string;
    lastMonth?: string;
    totalSpendingGoal: number;
    totalNetIncome: number;
    totalCmaWithdrawals: number;
    totalIraDistributions: number;
    totalSurplusDeficit: number;
    firstShortfallMonth?: string;
    shortfallMonthCount: number;
    endingClient1CashBalance?: number;
    endingClient2CashBalance?: number;
    endingCmaCashBalance?: number;
  };
}

type SafeCellValue = string | number | boolean | Date | null;

const ERROR_VALUES = new Set(["#NAME?", "#REF!", "#VALUE!", "#DIV/0!", "#N/A", "#NULL!", "#NUM!", "#GETTING_DATA"]);

export async function parseIncomeLadderWorkbookFromUrl(url: string): Promise<IncomeLadderReport> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load workbook (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return parseIncomeLadderWorkbookFromArrayBuffer(buffer, getWorkbookNameFromUrl(url));
}

export function parseIncomeLadderWorkbookFromArrayBuffer(buffer: ArrayBuffer, workbookName: string): IncomeLadderReport {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellFormula: false,
    cellNF: false,
    cellStyles: false,
  });
  const sheetName = workbook.SheetNames.includes("Sheet1") ? "Sheet1" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("The workbook does not contain a readable sheet.");
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:AC346");
  const lastRow = Math.max(range.e.r, 345);
  const monthlyRows = extractMonthlyRows(sheet, lastRow);
  const annualSummary = summarizeAnnualRows(monthlyRows);
  const maturityEvents = extractMaturityEvents(sheet, monthlyRows, lastRow);
  const beginningValues = extractBeginningValues(sheet);
  const metrics = calculateMetrics(monthlyRows, annualSummary, maturityEvents);

  return {
    workbookName,
    sheetName,
    rowsParsed: monthlyRows.length,
    monthlyRows,
    annualSummary,
    maturityEvents,
    beginningValues,
    metrics,
  };
}

function extractMonthlyRows(sheet: XLSX.WorkSheet, lastRow: number): MonthlyCashFlowRow[] {
  const rows: MonthlyCashFlowRow[] = [];

  for (let rowIndex = 9; rowIndex <= lastRow; rowIndex += 1) {
    const monthInfo = parseMonth(getCellValue(sheet, rowIndex, 2));

    if (!monthInfo) {
      continue;
    }

    const values = {
      spendingGoal: parseNumber(getCellValue(sheet, rowIndex, 3)),
      totalNetIncome: parseNumber(getCellValue(sheet, rowIndex, 4)),
      cmaWithdrawals: parseNumber(getCellValue(sheet, rowIndex, 5)),
      iraDistributions: parseNumber(getCellValue(sheet, rowIndex, 6)),
      surplusDeficit: parseNumber(getCellValue(sheet, rowIndex, 7)),
    };

    if (!hasAnyNumber(values)) {
      continue;
    }

    rows.push({
      month: monthInfo.month,
      label: monthInfo.label,
      year: monthInfo.year,
      spendingGoal: values.spendingGoal ?? 0,
      totalNetIncome: values.totalNetIncome ?? 0,
      cmaWithdrawals: values.cmaWithdrawals ?? 0,
      iraDistributions: values.iraDistributions ?? 0,
      surplusDeficit: values.surplusDeficit ?? 0,
    });
  }

  return rows;
}

function extractMaturityEvents(sheet: XLSX.WorkSheet, monthlyRows: MonthlyCashFlowRow[], lastRow: number): MaturityEvent[] {
  const monthByRow = new Map<number, MonthlyCashFlowRow>();

  for (let rowIndex = 9; rowIndex <= lastRow; rowIndex += 1) {
    const monthInfo = parseMonth(getCellValue(sheet, rowIndex, 2));
    const matchingRow = monthInfo ? monthlyRows.find((row) => row.month === monthInfo.month) : undefined;

    if (matchingRow) {
      monthByRow.set(rowIndex, matchingRow);
    }
  }

  const events: MaturityEvent[] = [];

  monthByRow.forEach((monthRow, rowIndex) => {
    addMaturityEvent(events, monthRow, "Client 1 IRA", {
      maturingAmount: parseNumber(getCellValue(sheet, rowIndex, 11)),
      cashBalance: parseNumber(getCellValue(sheet, rowIndex, 12)),
      distributionOrWithdrawal: parseNumber(getCellValue(sheet, rowIndex, 13)),
    });
    addMaturityEvent(events, monthRow, "Client 2 IRA", {
      maturingAmount: parseNumber(getCellValue(sheet, rowIndex, 15)),
      cashBalance: parseNumber(getCellValue(sheet, rowIndex, 16)),
      distributionOrWithdrawal: parseNumber(getCellValue(sheet, rowIndex, 17)),
    });
    addMaturityEvent(events, monthRow, "CMA", {
      maturingAmount: parseNumber(getCellValue(sheet, rowIndex, 19)),
      cashBalance: parseNumber(getCellValue(sheet, rowIndex, 20)),
      distributionOrWithdrawal: parseNumber(getCellValue(sheet, rowIndex, 21)),
    });
  });

  return events;
}

function addMaturityEvent(
  events: MaturityEvent[],
  monthRow: MonthlyCashFlowRow,
  account: MaturityEvent["account"],
  values: { maturingAmount: number | null; cashBalance: number | null; distributionOrWithdrawal: number | null },
) {
  if (!hasAnyNumber(values)) {
    return;
  }

  const maturingAmount = values.maturingAmount ?? 0;

  if (maturingAmount === 0 && (values.cashBalance ?? 0) === 0 && (values.distributionOrWithdrawal ?? 0) === 0) {
    return;
  }

  events.push({
    month: monthRow.month,
    label: monthRow.label,
    account,
    maturingAmount,
    cashBalance: values.cashBalance ?? undefined,
    distributionOrWithdrawal: values.distributionOrWithdrawal ?? undefined,
  });
}

function summarizeAnnualRows(monthlyRows: MonthlyCashFlowRow[]): AnnualCashFlowSummary[] {
  const summaries = new Map<number, AnnualCashFlowSummary>();

  monthlyRows.forEach((row) => {
    const summary =
      summaries.get(row.year) ??
      {
        year: row.year,
        spendingGoal: 0,
        totalNetIncome: 0,
        cmaWithdrawals: 0,
        iraDistributions: 0,
        surplusDeficit: 0,
      };

    summary.spendingGoal += row.spendingGoal;
    summary.totalNetIncome += row.totalNetIncome;
    summary.cmaWithdrawals += row.cmaWithdrawals;
    summary.iraDistributions += row.iraDistributions;
    summary.surplusDeficit += row.surplusDeficit;
    summaries.set(row.year, summary);
  });

  return Array.from(summaries.values()).sort((first, second) => first.year - second.year);
}

function extractBeginningValues(sheet: XLSX.WorkSheet): IncomeLadderReport["beginningValues"] {
  const result: IncomeLadderReport["beginningValues"] = {};

  for (let rowIndex = 1; rowIndex <= 4; rowIndex += 1) {
    const cells = [16, 17, 18].map((columnIndex) => getCellValue(sheet, rowIndex, columnIndex));
    const label = cells
      .map((cell) => (typeof cell === "string" ? cell : ""))
      .join(" ")
      .toLowerCase();
    const value = cells.map(parseNumber).find((cellValue): cellValue is number => typeof cellValue === "number" && cellValue !== 0);

    if (value === undefined) {
      continue;
    }

    if ((label.includes("client 1") || label.includes("ira 1")) && result.client1Ira === undefined) {
      result.client1Ira = value;
    } else if ((label.includes("client 2") || label.includes("ira 2")) && result.client2Ira === undefined) {
      result.client2Ira = value;
    } else if (label.includes("cma") && result.cma === undefined) {
      result.cma = value;
    }
  }

  return result;
}

function calculateMetrics(
  monthlyRows: MonthlyCashFlowRow[],
  annualSummary: AnnualCashFlowSummary[],
  maturityEvents: MaturityEvent[],
): IncomeLadderReport["metrics"] {
  const firstShortfall = monthlyRows.find((row) => row.surplusDeficit < 0);

  return {
    firstMonth: monthlyRows[0]?.month,
    lastMonth: monthlyRows[monthlyRows.length - 1]?.month,
    totalSpendingGoal: sum(monthlyRows, "spendingGoal"),
    totalNetIncome: sum(monthlyRows, "totalNetIncome"),
    totalCmaWithdrawals: sum(monthlyRows, "cmaWithdrawals"),
    totalIraDistributions: sum(monthlyRows, "iraDistributions"),
    totalSurplusDeficit: sum(monthlyRows, "surplusDeficit"),
    firstShortfallMonth: firstShortfall?.label,
    shortfallMonthCount: monthlyRows.filter((row) => row.surplusDeficit < 0).length,
    endingClient1CashBalance: getEndingCashBalance(maturityEvents, "Client 1 IRA"),
    endingClient2CashBalance: getEndingCashBalance(maturityEvents, "Client 2 IRA"),
    endingCmaCashBalance: getEndingCashBalance(maturityEvents, "CMA"),
  };
}

function getEndingCashBalance(events: MaturityEvent[], account: MaturityEvent["account"]) {
  const event = [...events].reverse().find((item) => item.account === account && typeof item.cashBalance === "number");
  return event?.cashBalance;
}

function getCellValue(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): SafeCellValue {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];

  if (!cell || cell.t === "e") {
    return null;
  }

  const displayed = typeof cell.w === "string" ? cell.w.trim() : "";

  if (displayed && ERROR_VALUES.has(displayed.toUpperCase())) {
    return null;
  }

  if (cell.v instanceof Date || typeof cell.v === "number" || typeof cell.v === "boolean") {
    return cell.v;
  }

  if (typeof cell.v === "string") {
    const trimmed = cell.v.trim();
    return ERROR_VALUES.has(trimmed.toUpperCase()) || trimmed === "" ? null : trimmed;
  }

  return displayed || null;
}

function parseNumber(value: SafeCellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .replace(/[,$\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/%$/, "");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseMonth(value: SafeCellValue): { month: string; label: string; year: number } | null {
  const parsedDate = value instanceof Date ? value : typeof value === "number" ? excelSerialDateToDate(value) : parseStringDate(value);

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const year = parsedDate.getFullYear();
  const monthNumber = parsedDate.getMonth() + 1;
  const month = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );

  return { month, label, year };
}

function parseStringDate(value: SafeCellValue): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function excelSerialDateToDate(value: number): Date | null {
  const parsed = XLSX.SSF.parse_date_code(value);

  if (!parsed || !parsed.y || !parsed.m) {
    return null;
  }

  return new Date(parsed.y, parsed.m - 1, parsed.d || 1);
}

function hasAnyNumber(values: Record<string, number | null>) {
  return Object.values(values).some((value) => typeof value === "number" && Number.isFinite(value) && value !== 0);
}

function sum(rows: MonthlyCashFlowRow[], key: keyof Pick<MonthlyCashFlowRow, "spendingGoal" | "totalNetIncome" | "cmaWithdrawals" | "iraDistributions" | "surplusDeficit">) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function getWorkbookNameFromUrl(url: string) {
  const cleanUrl = url.split(/[?#]/)[0];
  return cleanUrl.split("/").pop() || "Income Ladder workbook";
}
