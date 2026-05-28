import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { getNegativeAccountBalances, parseIncomeLadderWorkbookFromArrayBuffer } from "./parseIncomeLadderWorkbook";

function createSyntheticWorkbook(): ArrayBuffer {
  const rows: unknown[][] = Array.from({ length: 22 }, () => []);

  rows[8] = [];
  rows[8][3] = "Spending Goal";
  rows[8][4] = "Total Net Income";
  rows[8][5] = "CMA Withdrawals";
  rows[8][6] = "Total (net) IRA Distributions";
  rows[8][7] = "Surplus / Deficit Cash Flow";
  rows[8][11] = "Maturing Amount";
  rows[8][12] = "Cash Balance";
  rows[8][13] = "Monthly Distribution";
  rows[8][15] = "Maturing Amount";
  rows[8][16] = "Cash Balance";
  rows[8][17] = "Monthly Distribution";
  rows[8][19] = "Maturing Amount";
  rows[8][20] = "Cash Balance";
  rows[8][21] = "Monthly Withdrawal";

  const monthlyRows = [
    { month: new Date(2027, 0, 1), spendingGoal: 1000, income: 600, cma: 0, ira: 400, surplus: 0, c1Cash: 500, c1Dist: 150 },
    { month: new Date(2027, 1, 1), spendingGoal: 1000, income: 600, cma: 50, ira: 900, surplus: 300, c1Cash: 350, c1Dist: 250 },
    { month: new Date(2028, 0, 1), spendingGoal: 1100, income: 700, cma: 0, ira: 450, surplus: 50, c1Cash: 250, c1Dist: 100 },
    { month: new Date(2028, 1, 1), spendingGoal: 1100, income: 700, cma: 0, ira: 200, surplus: -200, c1Cash: -25, c2Cash: -75, c1Dist: 100 },
  ];

  monthlyRows.forEach((source, index) => {
    const row = [];
    row[2] = source.month;
    row[3] = source.spendingGoal;
    row[4] = source.income;
    row[5] = source.cma;
    row[6] = source.ira;
    row[7] = source.surplus;
    row[11] = index === 0 ? 100 : 0;
    row[12] = source.c1Cash;
    row[13] = source.c1Dist;
    row[15] = 0;
    row[16] = source.c2Cash ?? 125;
    row[17] = 0;
    row[19] = 0;
    row[20] = 0;
    row[21] = 0;
    rows[9 + index] = row;
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function createBoundaryWorkbook(): ArrayBuffer {
  const rows: unknown[][] = Array.from({ length: 140 }, () => []);
  rows[8] = [];

  const start = new Date(2027, 0, 1);
  for (let index = 0; index < 120; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const rowIndex = 9 + index;
    const row = [];
    row[2] = date;
    row[11] = 0;
    row[12] = 1000 - index;
    row[13] = 100;
    row[15] = 0;
    row[16] = 2000 - index;
    row[17] = 100;
    row[19] = 0;
    row[20] = 0;
    row[21] = 0;

    if (date.getFullYear() < 2035 || (date.getFullYear() === 2035 && date.getMonth() === 0)) {
      row[3] = 1000;
      row[4] = 500;
      row[5] = 0;
      row[6] = 500;
      row[7] = 0;
    }

    rows[rowIndex] = row;
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  for (let rowIndex = 106; rowIndex < 129; rowIndex += 1) {
    [3, 4, 5, 6, 7].forEach((columnIndex) => {
      sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] = {
        t: "n",
        v: 999,
        f: "[1]Data!A1",
        w: "$999",
      };
    });
  }

  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

describe("parseIncomeLadderWorkbookFromArrayBuffer", () => {
  const report = parseIncomeLadderWorkbookFromArrayBuffer(createSyntheticWorkbook(), "synthetic-income-ladder.xlsx");

  it("rolls annual totals up from displayed monthly workbook rows", () => {
    expect(report.rowsParsed).toBe(4);
    expect(report.annualSummary).toEqual([
      expect.objectContaining({
        year: 2027,
        spendingGoal: 2000,
        totalNetIncome: 1200,
        cmaWithdrawals: 50,
        iraDistributions: 1300,
        otherOutflows: 250,
        surplusDeficit: 300,
      }),
      expect.objectContaining({
        year: 2028,
        spendingGoal: 2200,
        totalNetIncome: 1400,
        cmaWithdrawals: 0,
        iraDistributions: 650,
        otherOutflows: 0,
        surplusDeficit: -150,
      }),
    ]);
  });

  it("reconciles surplus/deficit with workbook funding, spending goal, and other outflows", () => {
    report.monthlyRows.forEach((row) => {
      const portfolioFunding = row.iraDistributions + row.cmaWithdrawals;
      expect(row.totalNetIncome + portfolioFunding - row.spendingGoal - row.otherOutflows).toBeCloseTo(row.surplusDeficit, 2);
    });
  });

  it("keeps individual IRA monthly columns as distributions while the total IRA field is net", () => {
    expect(report.monthlyRows[0].client1Ira.netDistribution).toBe(150);
    expect(report.annualSummary[0].iraDistributions).toBe(1300);
    const appSource = readFileSync("src/App.tsx", "utf8");
    expect(appSource).toContain("Net IRA Distributions");
    expect(appSource).toContain("C1 Dist.");
    expect(appSource).toContain("C2 Dist.");
    expect(appSource).toContain("CMA Mat.");
    expect(appSource).toContain("CMA Cash");
    expect(appSource).toContain("CMA W/D");
    expect(appSource).toContain("Account balance warning");
    expect(appSource).not.toContain("C1 Net IRA");
    expect(appSource).not.toContain("C2 Net IRA");
  });

  it("detects negative account cash balances separately from monthly cash-flow shortfalls", () => {
    const negativeBalances = getNegativeAccountBalances(report.monthlyRows);
    expect(negativeBalances).toEqual([
      expect.objectContaining({ account: "Client 1 IRA", label: "Feb 2028", value: -25 }),
      expect.objectContaining({ account: "Client 2 IRA", label: "Feb 2028", value: -75 }),
    ]);
    expect(report.metrics.firstShortfallMonth).toBe("Feb 2028");
    expect(report.metrics.firstNegativeAccountBalanceMonth).toBe("Feb 2028");
    expect(report.metrics.accountsWithNegativeBalances).toEqual(["Client 1 IRA", "Client 2 IRA"]);
    expect(report.metrics.largestNegativeAccountBalance).toEqual(expect.objectContaining({ account: "Client 2 IRA", value: -75 }));
    const appSource = readFileSync("src/App.tsx", "utf8");
    expect(appSource).toContain("Warning: Account cash turns negative in");
    expect(appSource).toContain("Lowest displayed balance");
  });

  it("omits all-zero CMA account detail while preserving nonzero CMA withdrawals", () => {
    expect(report.monthlyRows.some((row) => row.cma.maturingAmount || row.cma.cashBalance || row.cma.withdrawal)).toBe(false);
    expect(report.annualSummary[0].cmaWithdrawals).toBe(50);
  });

  it("uses displayed-month labels instead of mislabeled source row counts in web and print output", () => {
    const appSource = readFileSync("src/App.tsx", "utf8");
    expect(appSource).toContain("Displayed months");
    expect(appSource).not.toContain("Cash-flow rows");
  });

  it("stops at the last workbook-backed month and excludes external formula rows", () => {
    const boundaryReport = parseIncomeLadderWorkbookFromArrayBuffer(createBoundaryWorkbook(), "synthetic-boundary.xlsx");

    expect(boundaryReport.monthlyRows[0].label).toBe("Jan 2027");
    expect(boundaryReport.monthlyRows.at(-1)?.label).toBe("Jan 2035");
    expect(boundaryReport.rowsParsed).toBe(97);
    expect(boundaryReport.sourceMonthlyRowCount).toBe(120);
    expect(boundaryReport.excludedMonthlyRowCount).toBe(23);
    expect(boundaryReport.dataBoundary).toEqual(
      expect.objectContaining({
        lastValidMonth: "Jan 2035",
        firstExcludedMonth: "Feb 2035",
      }),
    );
    expect(boundaryReport.monthlyRows.some((row) => row.year === 2036)).toBe(false);
    expect(boundaryReport.annualSummary.some((row) => row.year === 2036)).toBe(false);
    expect(boundaryReport.annualSummary.at(-1)).toEqual(expect.objectContaining({ year: 2035, monthsIncluded: 1 }));
    expect(boundaryReport.metrics.lastMonth).toBe("2035-01");
    expect(boundaryReport.metrics.totalSpendingGoal).toBe(97000);
  });

  it("does not track real workbook or generated PDF artifacts", () => {
    const trackedFiles = execSync("git ls-files", { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(trackedFiles).not.toContain("Sample Income Ladder (1).xlsx");
    expect(trackedFiles).not.toContain("Income Ladder Snapshot test 7.pdf");
    expect(trackedFiles.some((file) => /\.(xlsx|xlsm|xls|pdf|png|jpe?g|webp)$/i.test(file))).toBe(false);
    ["*.xlsx", "*.xls", "*.xlsm", "*.pdf", "*.png", "*.jpg", "*.jpeg", "*.webp", "outputs/", "screenshots/", "qa-artifacts/"].forEach((pattern) => {
      expect(gitignore).toContain(pattern);
    });
  });
});
