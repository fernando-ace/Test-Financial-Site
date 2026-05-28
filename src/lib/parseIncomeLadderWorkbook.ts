import * as XLSX from "xlsx";

export interface MonthlyCashFlowRow {
  month: string;
  label: string;
  year: number;
  spendingGoal: number;
  totalNetIncome: number;
  cmaWithdrawals: number;
  iraDistributions: number;
  otherOutflows: number;
  surplusDeficit: number;
  client1Ira: MonthlyAccountDetail;
  client2Ira: MonthlyAccountDetail;
  cma: MonthlyAccountDetail;
}

export interface MonthlyAccountDetail {
  maturingAmount?: number;
  cashBalance?: number;
  netDistribution?: number;
  withdrawal?: number;
}

export interface AnnualCashFlowSummary {
  year: number;
  monthsIncluded: number;
  spendingGoal: number;
  totalNetIncome: number;
  cmaWithdrawals: number;
  iraDistributions: number;
  otherOutflows: number;
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
  sourceMonthlyRowCount: number;
  excludedMonthlyRowCount: number;
  dataBoundary?: {
    lastValidMonth?: string;
    firstExcludedMonth?: string;
    reason: string;
  };
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
    totalOtherOutflows: number;
    totalSurplusDeficit: number;
    firstShortfallMonth?: string;
    shortfallMonthCount: number;
    firstNegativeAccountBalanceMonth?: string;
    negativeAccountBalanceCount: number;
    accountsWithNegativeBalances: string[];
    largestNegativeAccountBalance?: {
      account: MaturityEvent["account"];
      month: string;
      label: string;
      value: number;
    };
    endingClient1CashBalance?: number;
    endingClient2CashBalance?: number;
    endingCmaCashBalance?: number;
  };
}

type SafeCellValue = string | number | boolean | Date | null;

const ERROR_VALUES = new Set(["#NAME?", "#REF!", "#VALUE!", "#DIV/0!", "#N/A", "#NULL!", "#NUM!", "#GETTING_DATA"]);
const REQUIRED_MONTHLY_VALUE_COLUMNS = [3, 4, 5, 6, 7] as const;

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
    cellFormula: true,
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
  const monthlyExtraction = extractMonthlyRows(sheet, lastRow);
  const monthlyRows = monthlyExtraction.rows;
  const annualSummary = summarizeAnnualRows(monthlyRows);
  const maturityEvents = extractMaturityEvents(sheet, monthlyRows, lastRow);
  const beginningValues = extractBeginningValues(sheet);
  const metrics = calculateMetrics(monthlyRows, annualSummary, maturityEvents);

  return {
    workbookName,
    sheetName,
    rowsParsed: monthlyRows.length,
    sourceMonthlyRowCount: monthlyExtraction.sourceMonthlyRowCount,
    excludedMonthlyRowCount: monthlyExtraction.excludedMonthlyRowCount,
    dataBoundary: monthlyExtraction.dataBoundary,
    monthlyRows,
    annualSummary,
    maturityEvents,
    beginningValues,
    metrics,
  };
}

interface MonthlyRowsExtraction {
  rows: MonthlyCashFlowRow[];
  sourceMonthlyRowCount: number;
  excludedMonthlyRowCount: number;
  dataBoundary?: IncomeLadderReport["dataBoundary"];
}

function extractMonthlyRows(sheet: XLSX.WorkSheet, lastRow: number): MonthlyRowsExtraction {
  const rows: MonthlyCashFlowRow[] = [];
  let sourceMonthlyRowCount = 0;
  let excludedMonthlyRowCount = 0;
  let dataBoundary: IncomeLadderReport["dataBoundary"];

  for (let rowIndex = 9; rowIndex <= lastRow; rowIndex += 1) {
    const monthInfo = parseMonth(getCellValue(sheet, rowIndex, 2));

    if (!monthInfo) {
      continue;
    }

    sourceMonthlyRowCount += 1;

    const rowValidity = getMonthlyRowValidity(sheet, rowIndex);
    if (!rowValidity.isValid) {
      if (rows.length > 0) {
        excludedMonthlyRowCount = countRemainingMonthlyRows(sheet, rowIndex, lastRow);
        sourceMonthlyRowCount += Math.max(excludedMonthlyRowCount - 1, 0);
        dataBoundary = {
          lastValidMonth: rows[rows.length - 1]?.label,
          firstExcludedMonth: monthInfo.label,
          reason: rowValidity.reason ?? "Later workbook rows were excluded because they are not valid monthly ladder rows.",
        };
        break;
      }

      continue;
    }

    const values = {
      spendingGoal: parseNumber(getCellValue(sheet, rowIndex, 3)),
      totalNetIncome: parseNumber(getCellValue(sheet, rowIndex, 4)),
      cmaWithdrawals: parseNumber(getCellValue(sheet, rowIndex, 5)),
      iraDistributions: parseNumber(getCellValue(sheet, rowIndex, 6)),
      surplusDeficit: parseNumber(getCellValue(sheet, rowIndex, 7)),
    };
    const spendingGoal = values.spendingGoal ?? 0;
    const totalNetIncome = values.totalNetIncome ?? 0;
    const cmaWithdrawals = values.cmaWithdrawals ?? 0;
    const iraDistributions = values.iraDistributions ?? 0;
    const surplusDeficit = values.surplusDeficit ?? 0;
    const otherOutflows = normalizeCurrencyDifference(totalNetIncome + cmaWithdrawals + iraDistributions - spendingGoal - surplusDeficit);
    const client1Ira = {
      maturingAmount: parseNumber(getCellValue(sheet, rowIndex, 11)),
      cashBalance: parseNumber(getCellValue(sheet, rowIndex, 12)),
      netDistribution: parseNumber(getCellValue(sheet, rowIndex, 13)),
    };
    const client2Ira = {
      maturingAmount: parseNumber(getCellValue(sheet, rowIndex, 15)),
      cashBalance: parseNumber(getCellValue(sheet, rowIndex, 16)),
      netDistribution: parseNumber(getCellValue(sheet, rowIndex, 17)),
    };
    const cma = {
      maturingAmount: parseNumber(getCellValue(sheet, rowIndex, 19)),
      cashBalance: parseNumber(getCellValue(sheet, rowIndex, 20)),
      withdrawal: parseNumber(getCellValue(sheet, rowIndex, 21)),
    };

    if (!hasAnyNumber(values)) {
      if (rows.length > 0) {
        excludedMonthlyRowCount = countRemainingMonthlyRows(sheet, rowIndex, lastRow);
        sourceMonthlyRowCount += Math.max(excludedMonthlyRowCount - 1, 0);
        dataBoundary = {
          lastValidMonth: rows[rows.length - 1]?.label,
          firstExcludedMonth: monthInfo.label,
          reason: "Later workbook rows contain zero or blank financial values and were excluded.",
        };
        break;
      }

      continue;
    }

    rows.push({
      month: monthInfo.month,
      label: monthInfo.label,
      year: monthInfo.year,
      spendingGoal,
      totalNetIncome,
      cmaWithdrawals,
      iraDistributions,
      otherOutflows,
      surplusDeficit,
      client1Ira: compactAccountDetail(client1Ira),
      client2Ira: compactAccountDetail(client2Ira),
      cma: compactAccountDetail(cma),
    });
  }

  return {
    rows,
    sourceMonthlyRowCount,
    excludedMonthlyRowCount,
    dataBoundary,
  };
}

function getMonthlyRowValidity(sheet: XLSX.WorkSheet, rowIndex: number) {
  for (const columnIndex of REQUIRED_MONTHLY_VALUE_COLUMNS) {
    const cell = getCellInfo(sheet, rowIndex, columnIndex);

    if (cell.hasError) {
      return { isValid: false, reason: "Later workbook rows contain formula errors and were excluded." };
    }

    if (cell.hasExternalFormula) {
      return { isValid: false, reason: "Later workbook rows contain external-link formulas and were excluded." };
    }

    if (parseNumber(cell.value) === null) {
      return { isValid: false, reason: "Later workbook rows contain blank or invalid financial values and were excluded." };
    }
  }

  return { isValid: true };
}

function countRemainingMonthlyRows(sheet: XLSX.WorkSheet, startRowIndex: number, lastRow: number) {
  let count = 0;

  for (let rowIndex = startRowIndex; rowIndex <= lastRow; rowIndex += 1) {
    if (parseMonth(getCellValue(sheet, rowIndex, 2))) {
      count += 1;
    }
  }

  return count;
}

function compactAccountDetail(values: {
  maturingAmount: number | null;
  cashBalance: number | null;
  netDistribution?: number | null;
  withdrawal?: number | null;
}): MonthlyAccountDetail {
  return {
    maturingAmount: compactOptionalNumber(values.maturingAmount),
    cashBalance: compactOptionalNumber(values.cashBalance),
    netDistribution: compactOptionalNumber(values.netDistribution),
    withdrawal: compactOptionalNumber(values.withdrawal),
  };
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
        monthsIncluded: 0,
        spendingGoal: 0,
        totalNetIncome: 0,
        cmaWithdrawals: 0,
        iraDistributions: 0,
        otherOutflows: 0,
        surplusDeficit: 0,
      };

    summary.monthsIncluded += 1;
    summary.spendingGoal += row.spendingGoal;
    summary.totalNetIncome += row.totalNetIncome;
    summary.cmaWithdrawals += row.cmaWithdrawals;
    summary.iraDistributions += row.iraDistributions;
    summary.otherOutflows += row.otherOutflows;
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
  const negativeBalances = getNegativeAccountBalances(monthlyRows);
  const largestNegativeAccountBalance = negativeBalances.reduce<(typeof negativeBalances)[number] | undefined>(
    (largest, item) => (!largest || item.value < largest.value ? item : largest),
    undefined,
  );

  return {
    firstMonth: monthlyRows[0]?.month,
    lastMonth: monthlyRows[monthlyRows.length - 1]?.month,
    totalSpendingGoal: sum(monthlyRows, "spendingGoal"),
    totalNetIncome: sum(monthlyRows, "totalNetIncome"),
    totalCmaWithdrawals: sum(monthlyRows, "cmaWithdrawals"),
    totalIraDistributions: sum(monthlyRows, "iraDistributions"),
    totalOtherOutflows: sum(monthlyRows, "otherOutflows"),
    totalSurplusDeficit: sum(monthlyRows, "surplusDeficit"),
    firstShortfallMonth: firstShortfall?.label,
    shortfallMonthCount: monthlyRows.filter((row) => row.surplusDeficit < 0).length,
    firstNegativeAccountBalanceMonth: negativeBalances[0]?.label,
    negativeAccountBalanceCount: negativeBalances.length,
    accountsWithNegativeBalances: Array.from(new Set(negativeBalances.map((item) => item.account))),
    largestNegativeAccountBalance,
    endingClient1CashBalance: getEndingCashBalance(maturityEvents, "Client 1 IRA"),
    endingClient2CashBalance: getEndingCashBalance(maturityEvents, "Client 2 IRA"),
    endingCmaCashBalance: getEndingCashBalance(maturityEvents, "CMA"),
  };
}

function getEndingCashBalance(events: MaturityEvent[], account: MaturityEvent["account"]) {
  const event = [...events].reverse().find((item) => item.account === account && typeof item.cashBalance === "number");
  return event?.cashBalance;
}

export interface NegativeAccountBalance {
  account: MaturityEvent["account"];
  month: string;
  label: string;
  value: number;
}

export function getNegativeAccountBalances(monthlyRows: MonthlyCashFlowRow[]): NegativeAccountBalance[] {
  const balances: NegativeAccountBalance[] = [];

  monthlyRows.forEach((row) => {
    addNegativeBalance(balances, row, "Client 1 IRA", row.client1Ira.cashBalance);
    addNegativeBalance(balances, row, "Client 2 IRA", row.client2Ira.cashBalance);
    addNegativeBalance(balances, row, "CMA", row.cma.cashBalance);
  });

  return balances;
}

function addNegativeBalance(balances: NegativeAccountBalance[], row: MonthlyCashFlowRow, account: MaturityEvent["account"], value?: number) {
  if (typeof value === "number" && Number.isFinite(value) && value < 0) {
    balances.push({
      account,
      month: row.month,
      label: row.label,
      value,
    });
  }
}

function getCellValue(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): SafeCellValue {
  return getCellInfo(sheet, rowIndex, columnIndex).value;
}

function getCellInfo(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number) {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];

  if (!cell) {
    return {
      value: null,
      hasError: false,
      hasExternalFormula: false,
    };
  }

  if (cell.t === "e") {
    return {
      value: null,
      hasError: true,
      hasExternalFormula: false,
    };
  }

  const displayed = typeof cell.w === "string" ? cell.w.trim() : "";
  const formula = typeof cell.f === "string" ? cell.f : "";
  const hasExternalFormula = /\[[^\]]+\]/.test(formula);

  if (displayed && ERROR_VALUES.has(displayed.toUpperCase())) {
    return { value: null, hasError: true, hasExternalFormula };
  }

  if (cell.v instanceof Date || typeof cell.v === "number" || typeof cell.v === "boolean") {
    return { value: cell.v, hasError: false, hasExternalFormula };
  }

  if (typeof cell.v === "string") {
    const trimmed = cell.v.trim();
    return {
      value: ERROR_VALUES.has(trimmed.toUpperCase()) || trimmed === "" ? null : trimmed,
      hasError: ERROR_VALUES.has(trimmed.toUpperCase()),
      hasExternalFormula,
    };
  }

  return { value: displayed || null, hasError: false, hasExternalFormula };
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

function compactOptionalNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : undefined;
}

function normalizeCurrencyDifference(value: number) {
  return Math.abs(value) < 0.005 ? 0 : value;
}

function sum(
  rows: MonthlyCashFlowRow[],
  key: keyof Pick<MonthlyCashFlowRow, "spendingGoal" | "totalNetIncome" | "cmaWithdrawals" | "iraDistributions" | "otherOutflows" | "surplusDeficit">,
) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function getWorkbookNameFromUrl(url: string) {
  const cleanUrl = url.split(/[?#]/)[0];
  return cleanUrl.split("/").pop() || "Income Ladder workbook";
}
