import { ChangeEvent, Fragment, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Eraser, FileSpreadsheet, Landmark, Printer, TrendingDown, TrendingUp, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AnnualCashFlowSummary,
  IncomeLadderReport,
  MaturityEvent,
  MonthlyCashFlowRow,
  NegativeAccountBalance,
  getNegativeAccountBalances,
  parseIncomeLadderWorkbookFromArrayBuffer,
} from "./lib/parseIncomeLadderWorkbook";
import { formatCurrency, formatSignedCurrency } from "./lib/formatters";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ReportMetadata {
  clientName: string;
  preparedBy: string;
  reportDate: string;
}

interface DisplayMetrics {
  totalSpendingGoal: number;
  totalNetIncome: number;
  totalIraDistributions: number;
  totalCmaWithdrawals: number;
  totalPortfolioDistributions: number;
  totalOtherOutflows: number;
  totalSurplusDeficit: number;
  firstShortfallMonth?: string;
  shortfallMonthCount: number;
  firstNegativeAccountBalanceMonth?: string;
  negativeAccountBalanceCount: number;
  accountsWithNegativeBalances: string[];
  largestNegativeAccountBalance?: NegativeAccountBalance;
}

type AnnualCoverageRow = AnnualCashFlowSummary & {
  yearLabel: string;
  portfolioDistributions: number;
};

interface AnnualCoverageTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
    payload?: AnnualCoverageRow;
  }>;
}

const INITIAL_STATUS = "No workbook loaded. Upload an Income Ladder workbook to generate a client snapshot.";
const ANNUAL_DISPLAY_YEAR_LIMIT = 10;
const PORTFOLIO_DISTRIBUTION_COLOR = "#d97706";

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [report, setReport] = useState<IncomeLadderReport | null>(null);
  const [metadata, setMetadata] = useState<ReportMetadata>({
    clientName: "",
    preparedBy: "",
    reportDate: getTodayInputValue(),
  });
  const [advisorNotes, setAdvisorNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [collapsedLedgerYears, setCollapsedLedgerYears] = useState<Set<number>>(() => new Set());

  const reportDateLabel = useMemo(() => formatDateLabel(metadata.reportDate), [metadata.reportDate]);
  const annualDisplayRows = useMemo(() => getAnnualDisplayRows(report?.annualSummary ?? []), [report]);
  const monthlyDisplayRows = useMemo(() => getMonthlyDisplayRows(report?.monthlyRows ?? [], annualDisplayRows), [report, annualDisplayRows]);
  const displayMetrics = useMemo(() => getDisplayMetrics(annualDisplayRows, monthlyDisplayRows), [annualDisplayRows, monthlyDisplayRows]);
  const previewMaturities = useMemo(() => getUpcomingMaturities(report?.maturityEvents ?? [], 10), [report]);
  const printMaturities = useMemo(() => getUpcomingMaturities(report?.maturityEvents ?? [], 6), [report]);
  const displayPeriod = useMemo(() => (report ? formatDisplayPeriod(report, annualDisplayRows) : "Not available"), [report, annualDisplayRows]);
  const insights = useMemo(() => (report ? getInsights(annualDisplayRows, displayMetrics, displayPeriod) : null), [report, annualDisplayRows, displayMetrics, displayPeriod]);

  async function handleWorkbookUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!(reader.result instanceof ArrayBuffer)) {
          throw new Error("The workbook could not be read as a file buffer.");
        }

        const parsedReport = parseIncomeLadderWorkbookFromArrayBuffer(reader.result, file.name);

        if (parsedReport.monthlyRows.length === 0) {
          throw new Error("No Income Ladder cash-flow rows were found. Confirm the workbook uses Sheet1 with month values in column C.");
        }

        setReport(parsedReport);
        setAdvisorNotes("");
        setCollapsedLedgerYears(new Set());
        setStatusMessage(`${file.name} loaded locally. Workbook data remains in browser memory only.`);
      } catch (caughtError: unknown) {
        setReport(null);
        setError(caughtError instanceof Error ? caughtError.message : "The selected workbook could not be parsed.");
        setStatusMessage(INITIAL_STATUS);
      } finally {
        setIsLoading(false);
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setReport(null);
      setError("The selected workbook could not be read.");
      setIsLoading(false);
      setStatusMessage(INITIAL_STATUS);
      event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  }

  function updateMetadata(field: keyof ReportMetadata, value: string) {
    setMetadata((current) => ({ ...current, [field]: value }));
  }

  function clearCurrentReport() {
    setReport(null);
    setMetadata({
      clientName: "",
      preparedBy: "",
      reportDate: getTodayInputValue(),
    });
    setAdvisorNotes("");
    setCollapsedLedgerYears(new Set());
    setError(null);
    setStatusMessage("Current report cleared from memory.");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function toggleLedgerYear(year: number) {
    setCollapsedLedgerYears((current) => {
      const next = new Set(current);

      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }

      return next;
    });
  }

  function expandAllLedgerYears() {
    setCollapsedLedgerYears(new Set());
  }

  function collapseAllLedgerYears() {
    setCollapsedLedgerYears(new Set(annualDisplayRows.map((row) => row.year)));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4">
        <header className="no-print rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Wells Fargo Advisors</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Income Ladder Snapshot</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Turn a private income ladder workbook into a clean client-ready PDF.
              </p>
              <p className="mt-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
                Workbook data is parsed locally in this browser and is not uploaded or saved.
              </p>
            </div>

            <div className="lg:w-auto">
              <div className="grid gap-2 sm:grid-cols-3">
                <ActionButton icon={Upload} label="Upload Excel" onClick={() => fileInputRef.current?.click()} />
                <ActionButton icon={Eraser} label="Clear current report" onClick={clearCurrentReport} disabled={!report && !metadata.clientName && !metadata.preparedBy && !advisorNotes} />
                <ActionButton
                  icon={Printer}
                  label="Generate Client PDF"
                  onClick={() => {
                    if (report) {
                      window.print();
                    }
                  }}
                  disabled={!report}
                  primary
                />
              </div>
              <p className="no-print mt-2 max-w-md text-xs leading-5 text-slate-500">
                When saving as PDF, turn off browser headers and footers for the cleanest report.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleWorkbookUpload}
                className="sr-only"
                aria-label="Upload Income Ladder Excel workbook"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
            <ReportField label="Client name" value={metadata.clientName} placeholder="Client or household" onChange={(value) => updateMetadata("clientName", value)} />
            <ReportField label="Prepared by" value={metadata.preparedBy} placeholder="Advisor name" onChange={(value) => updateMetadata("preparedBy", value)} />
            <ReportField label="Report date" type="date" value={metadata.reportDate} onChange={(value) => updateMetadata("reportDate", value)} />
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <p role="status">{statusMessage}</p>
          </div>
        </header>

        {!isLoading && report && insights ? (
          <CompactPrintReport
            advisorNotes={advisorNotes}
            insights={insights}
            metadata={metadata}
            maturities={printMaturities}
            report={report}
            reportDateLabel={reportDateLabel}
            displayPeriod={displayPeriod}
            displayMetrics={displayMetrics}
            annualRows={annualDisplayRows}
            monthlyRows={monthlyDisplayRows}
          />
        ) : null}

        <section className="web-report flex min-w-0 flex-col gap-4">
          {isLoading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} /> : null}

          {!isLoading && !error && !report ? <EmptyState /> : null}

          {!isLoading && report && insights ? (
            <section className="flex min-w-0 flex-col gap-4">
              <WorkbookSummary metadata={metadata} report={report} reportDateLabel={reportDateLabel} displayPeriod={displayPeriod} displayedMonthCount={monthlyDisplayRows.length} />
              <DataBoundaryWarning report={report} />

              <MonthlyIncomeLadderTable
                collapsedYears={collapsedLedgerYears}
                onCollapseAll={collapseAllLedgerYears}
                onExpandAll={expandAllLedgerYears}
                onToggleYear={toggleLedgerYear}
                rows={monthlyDisplayRows}
                totalRows={report.rowsParsed}
              />

              <section className="kpi-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard label="Total Spending Goal" value={displayMetrics.totalSpendingGoal} icon={CalendarDays} caption={displayPeriod} />
                <KpiCard label="Total Net Income" value={displayMetrics.totalNetIncome} icon={Landmark} caption="Modeled income over period" />
                <KpiCard label="Net IRA Distributions" value={displayMetrics.totalIraDistributions} icon={FileSpreadsheet} caption="Total modeled net IRA distributions" />
                <KpiCard label="CMA Withdrawals" value={displayMetrics.totalCmaWithdrawals} icon={Upload} caption="Total modeled CMA withdrawals" />
                {displayMetrics.totalOtherOutflows !== 0 ? (
                  <KpiCard label="Workbook Adjustments" value={displayMetrics.totalOtherOutflows} icon={TrendingDown} caption="Workbook-derived reconciliation to surplus / deficit" />
                ) : null}
                <KpiCard label="Total Surplus / Deficit" value={displayMetrics.totalSurplusDeficit} icon={TrendingUp} signed caption="Aggregate cash-flow result" />
                <KpiCard label="First Cash-Flow Shortfall" value={displayMetrics.firstShortfallMonth ?? "None found"} icon={TrendingDown} caption={`${displayMetrics.shortfallMonthCount} monthly cash-flow shortfalls`} />
                <KpiCard
                  label="First Negative Account Balance"
                  value={displayMetrics.firstNegativeAccountBalanceMonth ?? "None found"}
                  icon={TrendingDown}
                  caption={
                    displayMetrics.negativeAccountBalanceCount > 0
                      ? `${displayMetrics.accountsWithNegativeBalances.join(", ")} account cash balances go negative`
                      : "No negative account cash balances in displayed months"
                  }
                />
              </section>

              <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
                <AnnualCoverageChart annualSummary={annualDisplayRows} />
                <AnnualSurplusPanel annualSummary={annualDisplayRows} />
              </section>

              <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <MaturityTable maturities={previewMaturities} />
                <InsightPanel insights={insights} />
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Advisor notes</h2>
                <textarea
                  value={advisorNotes}
                  onChange={(event) => setAdvisorNotes(event.target.value)}
                  placeholder="Add optional notes for the client report..."
                  className="mt-3 min-h-24 w-full rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </section>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function WorkbookSummary({
  displayPeriod,
  displayedMonthCount,
  metadata,
  report,
  reportDateLabel,
}: {
  displayPeriod: string;
  displayedMonthCount: number;
  metadata: ReportMetadata;
  report: IncomeLadderReport;
  reportDateLabel: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workbook snapshot</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{metadata.clientName || "Income ladder client snapshot"}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Source: {cleanWorkbookName(report.workbookName)}, {report.sheetName} sheet
          </p>
        </div>
        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-4 lg:min-w-[560px]">
          <ReportMetaItem label="Prepared by" value={metadata.preparedBy || "Not specified"} />
          <ReportMetaItem label="Report date" value={reportDateLabel} />
          <ReportMetaItem label="Displayed months" value={String(displayedMonthCount)} />
          <ReportMetaItem label="Period" value={displayPeriod} />
        </div>
      </div>
    </section>
  );
}

function DataBoundaryWarning({ report }: { report: IncomeLadderReport }) {
  if (!report.dataBoundary?.firstExcludedMonth) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Report period is limited to workbook-backed monthly rows.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
      <p className="font-semibold">
        Data stops at {report.dataBoundary.lastValidMonth}. Later workbook rows beginning {report.dataBoundary.firstExcludedMonth} were excluded.
      </p>
      <p className="mt-1 text-amber-800">{report.dataBoundary.reason} Report period is limited to workbook-backed monthly rows.</p>
    </section>
  );
}

function AnnualCoverageChart({ annualSummary }: { annualSummary: AnnualCoverageRow[] }) {
  return (
    <article className="chart-card min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">Annual cash-flow coverage</h2>
        <p className="text-sm text-slate-500">Spending goal compared with modeled income and portfolio funding.</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={annualSummary} margin={{ left: 4, right: 10, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="yearLabel" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
            <Tooltip content={<AnnualCoverageTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spendingGoal" name="Spending Goal" fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="totalNetIncome" name="Net Income" stackId="funding" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="portfolioDistributions" name="Portfolio Funding" stackId="funding" fill={PORTFOLIO_DISTRIBUTION_COLOR} radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function AnnualCoverageTooltip({ active, label, payload }: AnnualCoverageTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload.find((item) => item.payload)?.payload;

  if (!row) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <div className="mt-2 space-y-1 text-slate-600">
        <TooltipLine label="Spending Goal" value={row.spendingGoal} />
        <TooltipLine label="Net Income" value={row.totalNetIncome} />
        {row.otherOutflows !== 0 ? <TooltipLine label="Workbook Adjustment" value={row.otherOutflows} /> : null}
        <TooltipLine label="Portfolio Funding" value={row.portfolioDistributions} emphasized />
        <div className="space-y-0.5 border-l-2 border-slate-200 pl-3 text-xs">
          <TooltipLine label="Net IRA" value={row.iraDistributions} />
          <TooltipLine label="CMA" value={row.cmaWithdrawals} />
        </div>
      </div>
    </div>
  );
}

function TooltipLine({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: number }) {
  return (
    <div className={`flex min-w-56 items-center justify-between gap-5 ${emphasized ? "font-semibold text-slate-950" : ""}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function AnnualSurplusPanel({ annualSummary }: { annualSummary: AnnualCashFlowSummary[] }) {
  const maxAbsValue = Math.max(...annualSummary.map((row) => Math.abs(row.surplusDeficit)), 1);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Cash-flow health</h2>
      <p className="mt-1 text-sm text-slate-500">Annual surplus or deficit by year.</p>
      <div className="mt-4 space-y-3">
        {annualSummary.slice(0, 12).map((row) => {
          const width = Math.max((Math.abs(row.surplusDeficit) / maxAbsValue) * 100, 3);
          const isShortfall = row.surplusDeficit < 0;

          return (
            <div key={row.year}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">{row.year}</span>
                <span className={isShortfall ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{formatSignedCurrency(row.surplusDeficit)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${isShortfall ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function MaturityTable({ maturities }: { maturities: MaturityEvent[] }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Upcoming maturities</h2>
      <p className="mt-1 text-sm text-slate-500">Showing the next meaningful maturity events from the workbook.</p>
      {maturities.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No maturity events were available.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Month</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 text-right">Maturing Amount</th>
                <th className="px-3 py-2 text-right">Cash Balance</th>
                <th className="pl-3 py-2 text-right">Net Distribution/Withdrawal</th>
              </tr>
            </thead>
            <tbody>
              {maturities.map((event, index) => (
                <tr key={`${event.month}-${event.account}-${index}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">{event.label}</td>
                  <td className="px-3 py-2 text-slate-600">{event.account}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(event.maturingAmount)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatOptionalCurrency(event.cashBalance)}</td>
                  <td className="pl-3 py-2 text-right text-slate-600">{formatOptionalCurrency(event.distributionOrWithdrawal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function MonthlyIncomeLadderTable({
  collapsedYears,
  onCollapseAll,
  onExpandAll,
  onToggleYear,
  rows,
  totalRows,
}: {
  collapsedYears: Set<number>;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onToggleYear: (year: number) => void;
  rows: MonthlyCashFlowRow[];
  totalRows: number;
}) {
  if (rows.length === 0) {
    return null;
  }

  const visibleAccounts = getVisibleAccountGroups(rows);
  const hasOtherOutflows = rows.some((row) => row.otherOutflows !== 0);
  const columnCount = getMonthlyLedgerColumnCount(visibleAccounts, hasOtherOutflows);
  const isLimited = totalRows > rows.length;
  const balanceWarning = getAccountBalanceWarning(rows);
  const visibleYears = Array.from(new Set(rows.map((row) => row.year)));
  const allYearsCollapsed = visibleYears.every((year) => collapsedYears.has(year));

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Primary monthly view</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Monthly Income Ladder</h2>
          <p className="mt-1 text-sm text-slate-500">
            A polished spreadsheet-style view of where monthly cash flow is expected to come from.
            {isLimited ? ` Showing the first ${ANNUAL_DISPLAY_YEAR_LIMIT} years (${rows.length} of ${totalRows} valid months).` : ` Showing ${rows.length} valid workbook-backed months.`}
          </p>
          {balanceWarning ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Warning: Account cash turns negative in {balanceWarning.first.label}. Review funding source assumptions.
              <span className="block pt-1 text-xs font-medium text-amber-800">
                First account: {balanceWarning.first.account} {formatCurrency(balanceWarning.first.value)}. Lowest displayed balance: {balanceWarning.largest.account}{" "}
                {formatCurrency(balanceWarning.largest.value)} in {balanceWarning.largest.label}.
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={allYearsCollapsed ? onExpandAll : onCollapseAll}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {allYearsCollapsed ? "Expand all years" : "Collapse all years"}
          </button>
          <p className="text-sm font-semibold text-slate-600">{visibleYears.length} years shown</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="monthly-ledger-table w-full min-w-[760px] border-collapse text-xs md:min-w-0">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <th rowSpan={2} className="sticky left-0 top-0 z-30 w-32 bg-slate-100 px-3 py-3 text-left">
                Month
              </th>
              <th rowSpan={2} className="top-0 bg-slate-100 px-3 py-3 text-right">
                Spend
              </th>
              <th rowSpan={2} className="top-0 bg-slate-100 px-3 py-3 text-right">
                Income
              </th>
              {hasOtherOutflows ? (
                <th rowSpan={2} className="top-0 bg-slate-100 px-3 py-3 text-right">
                  Workbook Adj.
                </th>
              ) : null}
              {visibleAccounts.client1Ira ? (
                <th colSpan={3} className="top-0 border-l border-slate-200 bg-slate-100 px-3 py-2 text-center">
                  Client 1 IRA
                </th>
              ) : null}
              {visibleAccounts.client2Ira ? (
                <th colSpan={3} className="top-0 border-l border-slate-200 bg-slate-100 px-3 py-2 text-center">
                  Client 2 IRA
                </th>
              ) : null}
              {visibleAccounts.cma ? (
                <th colSpan={3} className="top-0 border-l border-slate-200 bg-slate-100 px-3 py-2 text-center">
                  CMA
                </th>
              ) : null}
              <th rowSpan={2} className="top-0 border-l border-slate-200 bg-slate-100 px-3 py-3 text-right">
                Funding
              </th>
              <th rowSpan={2} className="top-0 bg-slate-100 px-3 py-3 text-right">
                Surplus
              </th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {visibleAccounts.client1Ira ? (
                <>
                  <th className="border-l border-slate-200 px-3 py-2 text-right">Mat.</th>
                  <th className="px-3 py-2 text-right">Cash</th>
                  <th className="px-3 py-2 text-right">Dist.</th>
                </>
              ) : null}
              {visibleAccounts.client2Ira ? (
                <>
                  <th className="border-l border-slate-200 px-3 py-2 text-right">Mat.</th>
                  <th className="px-3 py-2 text-right">Cash</th>
                  <th className="px-3 py-2 text-right">Dist.</th>
                </>
              ) : null}
              {visibleAccounts.cma ? (
                <>
                  <th className="border-l border-slate-200 px-3 py-2 text-right">Mat.</th>
                  <th className="px-3 py-2 text-right">Cash</th>
                  <th className="px-3 py-2 text-right">W/D</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isFirstYearRow = index === 0 || rows[index - 1].year !== row.year;
              const isShortfall = row.surplusDeficit < 0;
              const isCollapsed = collapsedYears.has(row.year);

              return (
                <Fragment key={row.month}>
                  {isFirstYearRow ? (
                    <tr className="bg-slate-800 text-xs font-semibold uppercase tracking-wide text-white">
                      <td colSpan={columnCount} className="sticky left-0 z-10 px-3 py-2">
                        <button type="button" onClick={() => onToggleYear(row.year)} className="inline-flex items-center gap-2 text-left font-semibold text-white">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                          <span>{row.year}</span>
                        </button>
                      </td>
                    </tr>
                  ) : null}
                  {isCollapsed ? null : (
                    <tr className={`border-b border-slate-100 ${isShortfall ? "bg-rose-50/70" : "odd:bg-white even:bg-slate-50/60"}`}>
                      <td className={`sticky left-0 z-10 px-3 py-2.5 font-semibold ${isShortfall ? "bg-rose-50 text-rose-950" : "bg-inherit text-slate-950"}`}>{row.label}</td>
                      <LedgerCurrencyCell value={row.spendingGoal} />
                      <LedgerCurrencyCell value={row.totalNetIncome} />
                      {hasOtherOutflows ? <LedgerCurrencyCell value={row.otherOutflows} optional /> : null}
                      {visibleAccounts.client1Ira ? (
                        <>
                          <LedgerCurrencyCell value={row.client1Ira.maturingAmount} separated optional />
                          <LedgerCurrencyCell value={row.client1Ira.cashBalance} optional tone={getBalanceTone(row.client1Ira.cashBalance)} />
                          <LedgerCurrencyCell value={row.client1Ira.netDistribution} optional />
                        </>
                      ) : null}
                      {visibleAccounts.client2Ira ? (
                        <>
                          <LedgerCurrencyCell value={row.client2Ira.maturingAmount} separated optional />
                          <LedgerCurrencyCell value={row.client2Ira.cashBalance} optional tone={getBalanceTone(row.client2Ira.cashBalance)} />
                          <LedgerCurrencyCell value={row.client2Ira.netDistribution} optional />
                        </>
                      ) : null}
                      {visibleAccounts.cma ? (
                        <>
                          <LedgerCurrencyCell value={row.cma.maturingAmount} separated optional />
                          <LedgerCurrencyCell value={row.cma.cashBalance} optional tone={getBalanceTone(row.cma.cashBalance)} />
                          <LedgerCurrencyCell value={row.cma.withdrawal} optional />
                        </>
                      ) : null}
                      <LedgerCurrencyCell value={row.iraDistributions + row.cmaWithdrawals} separated emphasize />
                      <LedgerCurrencyCell value={row.surplusDeficit} signed emphasize tone={isShortfall ? "negative" : "positive"} />
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LedgerCurrencyCell({
  emphasize = false,
  optional = false,
  separated = false,
  signed = false,
  tone,
  value,
}: {
  emphasize?: boolean;
  optional?: boolean;
  separated?: boolean;
  signed?: boolean;
  tone?: "positive" | "negative";
  value?: number;
}) {
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const displayValue = hasValue ? (signed ? formatSignedCurrency(value) : formatCurrency(value)) : optional ? "" : formatCurrency(0);
  const toneClass = tone === "negative" ? "text-rose-700" : tone === "positive" ? "text-emerald-700" : "text-slate-700";
  const emphasisClass = emphasize || tone ? `font-semibold ${toneClass}` : "text-slate-700";

  return (
    <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${separated ? "border-l border-slate-200" : ""} ${emphasisClass}`}>
      {displayValue}
    </td>
  );
}

function getBalanceTone(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value < 0 ? "negative" : undefined;
}

function isNegativeBalance(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value < 0;
}

interface VisibleAccountGroups {
  client1Ira: boolean;
  client2Ira: boolean;
  cma: boolean;
}

function getVisibleAccountGroups(rows: MonthlyCashFlowRow[]): VisibleAccountGroups {
  return {
    client1Ira: rows.some((row) => hasAccountDetail(row.client1Ira)),
    client2Ira: rows.some((row) => hasAccountDetail(row.client2Ira)),
    cma: rows.length > 0,
  };
}

function hasAccountDetail(detail: MonthlyCashFlowRow["client1Ira"]) {
  return [detail.maturingAmount, detail.cashBalance, detail.netDistribution, detail.withdrawal].some((value) => typeof value === "number" && Number.isFinite(value) && value !== 0);
}

function getMonthlyLedgerColumnCount(visibleAccounts: VisibleAccountGroups, hasOtherOutflows = false) {
  return 5 + (hasOtherOutflows ? 1 : 0) + (visibleAccounts.client1Ira ? 3 : 0) + (visibleAccounts.client2Ira ? 3 : 0) + (visibleAccounts.cma ? 3 : 0);
}

function getAccountBalanceWarning(rows: MonthlyCashFlowRow[]) {
  const negativeBalances = getNegativeAccountBalances(rows);
  const first = negativeBalances[0];

  if (!first) {
    return null;
  }

  const largest = negativeBalances.reduce((largestNegative, balance) => (balance.value < largestNegative.value ? balance : largestNegative), first);
  return { first, largest };
}

function InsightPanel({ insights }: { insights: ReturnType<typeof getInsights> }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Snapshot insights</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <Insight label="Report period" value={insights.reportPeriod} />
        <Insight label="First projected shortfall" value={insights.firstShortfallMonth} />
        <Insight label="Shortfall months" value={insights.shortfallMonthCount} />
        <Insight label="Largest annual shortfall" value={insights.largestAnnualShortfall} />
        <Insight label="First negative account balance" value={insights.firstNegativeAccountBalanceMonth} />
        <Insight label="Account balance warning" value={insights.negativeAccountBalanceSummary} />
        <Insight label="Total net distributions/withdrawals" value={insights.totalDistributionWithdrawals} />
      </dl>
    </article>
  );
}

function CompactPrintReport({
  advisorNotes,
  annualRows,
  displayPeriod,
  displayMetrics,
  insights,
  maturities,
  metadata,
  monthlyRows,
  report,
  reportDateLabel,
}: {
  advisorNotes: string;
  annualRows: AnnualCoverageRow[];
  displayPeriod: string;
  displayMetrics: DisplayMetrics;
  insights: ReturnType<typeof getInsights>;
  maturities: MaturityEvent[];
  metadata: ReportMetadata;
  monthlyRows: MonthlyCashFlowRow[];
  report: IncomeLadderReport;
  reportDateLabel: string;
}) {
  const notes = advisorNotes.trim();
  const hasOtherOutflows = monthlyRows.some((row) => row.otherOutflows !== 0);
  const balanceWarning = getAccountBalanceWarning(monthlyRows);

  return (
    <section className="print-only compact-print-report">
      <header className="compact-print-header print-block">
        <p>Wells Fargo Advisors</p>
        <h1>Income Ladder Snapshot</h1>
        <dl>
          <div>
            <dt>Client</dt>
            <dd>{metadata.clientName || "Not specified"}</dd>
          </div>
          <div>
            <dt>Prepared by</dt>
            <dd>{metadata.preparedBy || "Not specified"}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{reportDateLabel}</dd>
          </div>
          <div>
            <dt>Workbook</dt>
            <dd>{cleanWorkbookName(report.workbookName)}</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>{displayPeriod}</dd>
          </div>
          <div>
            <dt>Displayed months</dt>
            <dd>{monthlyRows.length}</dd>
          </div>
        </dl>
      </header>

      {report.dataBoundary?.firstExcludedMonth ? (
        <section className="compact-print-warning print-block">
          Data stops at {report.dataBoundary.lastValidMonth}. Later workbook rows beginning {report.dataBoundary.firstExcludedMonth} were excluded. {report.dataBoundary.reason}
        </section>
      ) : null}

      <section className="compact-print-grid print-block">
        <CompactPrintKpi label="Total Spending Goal" value={formatCurrency(displayMetrics.totalSpendingGoal)} />
        <CompactPrintKpi label="Total Net Income" value={formatCurrency(displayMetrics.totalNetIncome)} />
        <CompactPrintKpi label="Net IRA Distributions" value={formatCurrency(displayMetrics.totalIraDistributions)} />
        <CompactPrintKpi label="CMA Withdrawals" value={formatCurrency(displayMetrics.totalCmaWithdrawals)} />
        {hasOtherOutflows ? <CompactPrintKpi label="Workbook Adjustments" value={formatCurrency(displayMetrics.totalOtherOutflows)} /> : null}
        <CompactPrintKpi label="Total Surplus / Deficit" value={formatSignedCurrency(displayMetrics.totalSurplusDeficit)} />
      </section>

      <section className="compact-print-two-column print-block">
        <article className="compact-print-card compact-print-chart-card print-block">
          <h2>Annual cash-flow coverage</h2>
          <CompactPrintCoverageChart data={annualRows} />
        </article>

        <article className="compact-print-card print-block">
          <h2>Snapshot insights</h2>
          <dl className="compact-print-insights">
            <div>
              <dt>First shortfall month</dt>
              <dd>{insights.firstShortfallMonth}</dd>
            </div>
            <div>
              <dt>Shortfall month count</dt>
              <dd>{insights.shortfallMonthCount}</dd>
            </div>
            <div>
              <dt>Total modeled period</dt>
              <dd>{insights.reportPeriod}</dd>
            </div>
            <div>
              <dt>Largest annual shortfall</dt>
              <dd>{insights.largestAnnualShortfall}</dd>
            </div>
            <div>
              <dt>First negative account balance</dt>
              <dd>{insights.firstNegativeAccountBalanceMonth}</dd>
            </div>
            {balanceWarning ? (
              <div>
                <dt>Account balance warning</dt>
                <dd>
                  {balanceWarning.first.account} turns negative in {balanceWarning.first.label}; lowest displayed balance is {balanceWarning.largest.account}{" "}
                  {formatCurrency(balanceWarning.largest.value)} in {balanceWarning.largest.label}.
                </dd>
              </div>
            ) : null}
          </dl>
        </article>
      </section>

      <section className="compact-print-two-column compact-print-bottom-row">
        <article className="compact-print-card print-block">
          <h2>Annual summary</h2>
          <AnnualSummaryTable rows={annualRows} compact />
        </article>

        <article className="compact-print-card print-block">
          <h2>Upcoming maturities</h2>
          <CompactMaturityList maturities={maturities} />
        </article>
      </section>

      <section className="compact-print-ledger-flow">
        {notes ? (
          <article className="compact-print-card compact-print-notes print-block">
            <h2>Advisor Notes</h2>
            <p>{notes}</p>
          </article>
        ) : null}

        <article className="compact-print-card compact-print-ledger-section">
          <h2>Monthly Income Ladder</h2>
          {balanceWarning ? (
            <p className="compact-print-warning">
              Warning: Account cash turns negative in {balanceWarning.first.label}. Review funding source assumptions. First account: {balanceWarning.first.account}{" "}
              {formatCurrency(balanceWarning.first.value)}.
            </p>
          ) : null}
          <PrintMonthlyLedger rows={monthlyRows} />
        </article>
      </section>
    </section>
  );
}

function AnnualSummaryTable({ rows, compact = false }: { rows: AnnualCashFlowSummary[]; compact?: boolean }) {
  const hasOtherOutflows = rows.some((row) => row.otherOutflows !== 0);

  return (
    <table className={compact ? "compact-print-table" : "w-full border-collapse text-sm"}>
      <thead>
        <tr>
          <th>Year</th>
          <th className="numeric">Spending Goal</th>
          <th className="numeric">Net Income</th>
          <th className="numeric">Net IRA Distributions</th>
          <th className="numeric">CMA Withdrawals</th>
          {hasOtherOutflows ? <th className="numeric">Workbook Adjustments</th> : null}
          <th className="numeric">Surplus / Deficit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.year}>
            <td>{formatAnnualSummaryYear(row)}</td>
            <td className="numeric">{formatCurrency(row.spendingGoal)}</td>
            <td className="numeric">{formatCurrency(row.totalNetIncome)}</td>
            <td className="numeric">{formatCurrency(row.iraDistributions)}</td>
            <td className="numeric">{formatCurrency(row.cmaWithdrawals)}</td>
            {hasOtherOutflows ? <td className="numeric">{formatCurrency(row.otherOutflows)}</td> : null}
            <td className="numeric">{formatSignedCurrency(row.surplusDeficit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintMonthlyLedger({ rows }: { rows: MonthlyCashFlowRow[] }) {
  const visibleAccounts = getVisibleAccountGroups(rows);
  const hasOtherOutflows = rows.some((row) => row.otherOutflows !== 0);
  const columnCount = getMonthlyLedgerColumnCount(visibleAccounts, hasOtherOutflows);

  return (
    <table className="compact-print-table compact-print-ledger-table">
      <thead>
        <tr>
          <th>Month</th>
          <th className="numeric">Goal</th>
          <th className="numeric">Net Income</th>
          {hasOtherOutflows ? <th className="numeric">Workbook Adj.</th> : null}
          {visibleAccounts.client1Ira ? (
            <>
              <th className="numeric">C1 Mat.</th>
              <th className="numeric">C1 Cash</th>
              <th className="numeric">C1 Dist.</th>
            </>
          ) : null}
          {visibleAccounts.client2Ira ? (
            <>
              <th className="numeric">C2 Mat.</th>
              <th className="numeric">C2 Cash</th>
              <th className="numeric">C2 Dist.</th>
            </>
          ) : null}
          {visibleAccounts.cma ? (
            <>
              <th className="numeric">CMA Mat.</th>
              <th className="numeric">CMA Cash</th>
              <th className="numeric">CMA W/D</th>
            </>
          ) : null}
          <th className="numeric">Portfolio Funding</th>
          <th className="numeric">Surplus / Deficit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const isFirstYearRow = index === 0 || rows[index - 1].year !== row.year;
          const isShortfall = row.surplusDeficit < 0;

          return (
            <Fragment key={row.month}>
              {isFirstYearRow ? (
                <tr className="compact-print-year-row">
                  <td colSpan={columnCount}>{row.year}</td>
                </tr>
              ) : null}
              <tr className={isShortfall ? "compact-print-shortfall-row" : ""}>
                <td>{row.label}</td>
                <td className="numeric">{formatCurrency(row.spendingGoal)}</td>
                <td className="numeric">{formatCurrency(row.totalNetIncome)}</td>
                {hasOtherOutflows ? <td className="numeric">{formatLedgerOptionalCurrency(row.otherOutflows)}</td> : null}
                {visibleAccounts.client1Ira ? (
                  <>
                    <td className="numeric">{formatLedgerOptionalCurrency(row.client1Ira.maturingAmount)}</td>
                    <td className={`numeric ${isNegativeBalance(row.client1Ira.cashBalance) ? "compact-print-negative-cell" : ""}`}>{formatLedgerOptionalCurrency(row.client1Ira.cashBalance)}</td>
                    <td className="numeric">{formatLedgerOptionalCurrency(row.client1Ira.netDistribution)}</td>
                  </>
                ) : null}
                {visibleAccounts.client2Ira ? (
                  <>
                    <td className="numeric">{formatLedgerOptionalCurrency(row.client2Ira.maturingAmount)}</td>
                    <td className={`numeric ${isNegativeBalance(row.client2Ira.cashBalance) ? "compact-print-negative-cell" : ""}`}>{formatLedgerOptionalCurrency(row.client2Ira.cashBalance)}</td>
                    <td className="numeric">{formatLedgerOptionalCurrency(row.client2Ira.netDistribution)}</td>
                  </>
                ) : null}
                {visibleAccounts.cma ? (
                  <>
                    <td className="numeric">{formatLedgerOptionalCurrency(row.cma.maturingAmount)}</td>
                    <td className={`numeric ${isNegativeBalance(row.cma.cashBalance) ? "compact-print-negative-cell" : ""}`}>{formatLedgerOptionalCurrency(row.cma.cashBalance)}</td>
                    <td className="numeric">{formatLedgerOptionalCurrency(row.cma.withdrawal)}</td>
                  </>
                ) : null}
                <td className="numeric">{formatCurrency(row.iraDistributions + row.cmaWithdrawals)}</td>
                <td className="numeric">{formatSignedCurrency(row.surplusDeficit)}</td>
              </tr>
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function CompactMaturityList({ maturities }: { maturities: MaturityEvent[] }) {
  if (maturities.length === 0) {
    return <p className="compact-empty">No upcoming maturity events available.</p>;
  }

  return (
    <table className="compact-print-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Account</th>
          <th className="numeric">Maturing</th>
        </tr>
      </thead>
      <tbody>
        {maturities.map((event, index) => (
          <tr key={`${event.month}-${event.account}-${index}`}>
            <td>{event.label}</td>
            <td>{event.account}</td>
            <td className="numeric">{formatCurrency(event.maturingAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompactPrintCoverageChart({ data }: { data: AnnualCoverageRow[] }) {
  const totals = {
    spendingGoal: sumAnnualRows(data, "spendingGoal"),
    totalNetIncome: sumAnnualRows(data, "totalNetIncome"),
    iraDistributions: sumAnnualRows(data, "iraDistributions"),
    cmaWithdrawals: sumAnnualRows(data, "cmaWithdrawals"),
  };
  const totalPortfolioDistributions = totals.iraDistributions + totals.cmaWithdrawals;
  const activeLegendItems = [
    totals.spendingGoal > 0 ? { label: "SPENDING GOAL", color: "#0f766e" } : null,
    totals.totalNetIncome > 0 ? { label: "NET INCOME", color: "#2563eb" } : null,
    totalPortfolioDistributions > 0 ? { label: "PORTFOLIO FUNDING", color: PORTFOLIO_DISTRIBUTION_COLOR } : null,
  ].filter((item): item is { label: string; color: string } => Boolean(item));

  const rowHeight = 26;
  const chartWidth = 560;
  const yearLabelWidth = 54;
  const valueLabelWidth = 84;
  const valueLabelGap = 14;
  const drawableBarWidth = chartWidth - yearLabelWidth - valueLabelWidth - valueLabelGap;
  const legendY = 14;
  const legendItemSwatchWidth = 16;
  const legendItemTextGap = 6;
  const legendLeftX = yearLabelWidth;
  const legendRightX = chartWidth - valueLabelWidth;
  const legendRowHeight = 13;
  const legendRows = activeLegendItems.length > 3 ? 2 : 1;
  const legendItemsPerRow = Math.ceil(activeLegendItems.length / legendRows);
  const firstRowY = legendRows > 1 ? 52 : 38;
  const chartHeight = firstRowY + 6 + data.length * rowHeight;
  const maxChartValue = Math.max(
    ...data.flatMap((item) => [item.spendingGoal, item.totalNetIncome + item.iraDistributions + item.cmaWithdrawals]),
    1,
  );

  return (
    <svg className="compact-print-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Annual cash-flow coverage">
      {activeLegendItems.map((item, index) => {
        const rowIndex = Math.floor(index / legendItemsPerRow);
        const rowItemIndex = index % legendItemsPerRow;
        const rowStartIndex = rowIndex * legendItemsPerRow;
        const rowItemCount = Math.min(legendItemsPerRow, activeLegendItems.length - rowStartIndex);
        const legendSlotWidth = (legendRightX - legendLeftX) / rowItemCount;
        const estimatedItemWidth = legendItemSwatchWidth + legendItemTextGap + item.label.length * 4.8;
        const itemCenterX = legendLeftX + legendSlotWidth * rowItemIndex + legendSlotWidth / 2;
        const itemX = Math.max(0, itemCenterX - estimatedItemWidth / 2);
        const itemY = 6 + rowIndex * legendRowHeight;

        return (
          <g key={item.label}>
            <rect x={itemX} y={itemY} width={legendItemSwatchWidth} height="8" rx="4" fill={item.color} />
            <text x={itemX + legendItemSwatchWidth + legendItemTextGap} y={legendY + rowIndex * legendRowHeight} fill="#475569" fontSize="8.5" fontWeight="800">
              {item.label}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const y = firstRowY + index * rowHeight;
        const spendingWidth = Math.max((item.spendingGoal / maxChartValue) * drawableBarWidth, 4);
        const incomeWidth = Math.max((item.totalNetIncome / maxChartValue) * drawableBarWidth, 4);
        const portfolioDistributions = item.iraDistributions + item.cmaWithdrawals;
        const distributionWidth = portfolioDistributions > 0 ? Math.max((portfolioDistributions / maxChartValue) * drawableBarWidth, 4) : 0;

        return (
          <g key={item.year}>
            {index > 0 ? <line x1="0" x2={chartWidth} y1={y - 4} y2={y - 4} stroke="#e2e8f0" strokeWidth="1" /> : null}
            <text x="0" y={y + 7} fill="#334155" fontSize="10" fontWeight="700">
              {item.yearLabel}
            </text>
            <rect x={yearLabelWidth} y={y - 1} width={drawableBarWidth} height="7" rx="3.5" fill="#e2e8f0" />
            <rect x={yearLabelWidth} y={y - 1} width={spendingWidth} height="7" rx="3.5" fill="#0f766e" />
            <rect x={yearLabelWidth} y={y + 10} width={drawableBarWidth} height="7" rx="3.5" fill="#e2e8f0" />
            <rect x={yearLabelWidth} y={y + 10} width={incomeWidth} height="7" rx="3.5" fill="#2563eb" />
            {distributionWidth > 0 ? <rect x={yearLabelWidth + incomeWidth} y={y + 10} width={distributionWidth} height="7" rx="3.5" fill={PORTFOLIO_DISTRIBUTION_COLOR} /> : null}
            <text x={chartWidth} y={y + 7} fill="#020617" fontSize="10" fontWeight="800" textAnchor="end">
              {formatSignedCurrency(item.surplusDeficit)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiCard({
  caption,
  icon: Icon,
  label,
  signed = false,
  value,
}: {
  caption: string;
  icon: LucideIcon;
  label: string;
  signed?: boolean;
  value: number | string;
}) {
  const displayValue = typeof value === "number" ? (signed ? formatSignedCurrency(value) : formatCurrency(value)) : value;

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-normal text-slate-950">{displayValue}</p>
        </div>
        <div className="rounded-md bg-teal-50 p-2.5 text-teal-700 ring-1 ring-teal-100">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{caption}</p>
    </article>
  );
}

function CompactPrintKpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="compact-print-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function ActionButton({
  disabled = false,
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
        primary
          ? "border-teal-700 bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-600"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-teal-500"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function ReportField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function ReportMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
      <h2 className="mt-5 text-xl font-semibold text-slate-950">Reading workbook</h2>
      <p className="mt-2 text-sm text-slate-500">Parsing displayed Excel values locally in this browser.</p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-sm">
      <h2 className="text-lg font-semibold">Workbook could not be loaded</h2>
      <p className="mt-2 text-sm text-rose-700">{message}</p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">No workbook loaded</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Upload an Income Ladder workbook to generate a client snapshot.</p>
    </section>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function getInsights(annualRows: AnnualCashFlowSummary[], displayMetrics: DisplayMetrics, displayPeriod: string) {
  const largestAnnualShortfall = annualRows.reduce<AnnualCashFlowSummary | null>(
    (largest, row) => (row.surplusDeficit < 0 && (!largest || row.surplusDeficit < largest.surplusDeficit) ? row : largest),
    null,
  );
  const largestNegative = displayMetrics.largestNegativeAccountBalance;
  return {
    reportPeriod: displayPeriod,
    firstShortfallMonth: displayMetrics.firstShortfallMonth ?? "None found",
    shortfallMonthCount: `${displayMetrics.shortfallMonthCount} month${displayMetrics.shortfallMonthCount === 1 ? "" : "s"}`,
    largestAnnualShortfall: largestAnnualShortfall ? `${largestAnnualShortfall.year}: ${formatSignedCurrency(largestAnnualShortfall.surplusDeficit)}` : "None found",
    totalDistributionWithdrawals: formatCurrency(displayMetrics.totalPortfolioDistributions),
    firstNegativeAccountBalanceMonth: displayMetrics.firstNegativeAccountBalanceMonth ?? "None found",
    negativeAccountBalanceSummary: largestNegative
      ? `${displayMetrics.accountsWithNegativeBalances.join(", ")}; lowest ${largestNegative.account} ${formatCurrency(largestNegative.value)} in ${largestNegative.label}`
      : "None found",
  };
}

function getUpcomingMaturities(events: MaturityEvent[], limit: number) {
  const withMaturingAmount = events.filter((event) => event.maturingAmount !== 0);
  const source = withMaturingAmount.length > 0 ? withMaturingAmount : events;

  return source.slice(0, limit);
}

function getAnnualDisplayRows(rows: AnnualCashFlowSummary[]): AnnualCoverageRow[] {
  return rows.slice(0, ANNUAL_DISPLAY_YEAR_LIMIT).map((row) => ({
    ...row,
    yearLabel: formatAnnualSummaryYear(row),
    portfolioDistributions: row.iraDistributions + row.cmaWithdrawals,
  }));
}

function getMonthlyDisplayRows(rows: MonthlyCashFlowRow[], annualRows: AnnualCashFlowSummary[]) {
  const displayYears = new Set(annualRows.map((row) => row.year));
  return rows.filter((row) => displayYears.has(row.year));
}

function getDisplayMetrics(annualRows: AnnualCashFlowSummary[], monthlyRows: MonthlyCashFlowRow[]): DisplayMetrics {
  const firstShortfall = monthlyRows.find((row) => row.surplusDeficit < 0);
  const negativeBalances = getNegativeAccountBalances(monthlyRows);
  const largestNegativeAccountBalance = negativeBalances.reduce<NegativeAccountBalance | undefined>(
    (largest, item) => (!largest || item.value < largest.value ? item : largest),
    undefined,
  );

  const totalIraDistributions = sumAnnualRows(annualRows, "iraDistributions");
  const totalCmaWithdrawals = sumAnnualRows(annualRows, "cmaWithdrawals");

  return {
    totalSpendingGoal: sumAnnualRows(annualRows, "spendingGoal"),
    totalNetIncome: sumAnnualRows(annualRows, "totalNetIncome"),
    totalIraDistributions,
    totalCmaWithdrawals,
    totalPortfolioDistributions: totalIraDistributions + totalCmaWithdrawals,
    totalOtherOutflows: sumAnnualRows(annualRows, "otherOutflows"),
    totalSurplusDeficit: sumAnnualRows(annualRows, "surplusDeficit"),
    firstShortfallMonth: firstShortfall?.label,
    shortfallMonthCount: monthlyRows.filter((row) => row.surplusDeficit < 0).length,
    firstNegativeAccountBalanceMonth: negativeBalances[0]?.label,
    negativeAccountBalanceCount: negativeBalances.length,
    accountsWithNegativeBalances: Array.from(new Set(negativeBalances.map((item) => item.account))),
    largestNegativeAccountBalance,
  };
}

function sumAnnualRows(rows: AnnualCashFlowSummary[], key: keyof Omit<AnnualCashFlowSummary, "year">) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function formatDisplayPeriod(report: IncomeLadderReport, annualRows: AnnualCashFlowSummary[]) {
  const first = formatMonth(report.metrics.firstMonth);
  const last = formatMonth(report.metrics.lastMonth);

  if (first && last) {
    return first === last ? first : `${first} to ${last}`;
  }

  return formatPeriod(report);
}

function formatAnnualSummaryYear(row: AnnualCashFlowSummary) {
  return row.monthsIncluded === 12 ? String(row.year) : `${row.year} partial`;
}

function formatPeriod(report: IncomeLadderReport) {
  const first = formatMonth(report.metrics.firstMonth);
  const last = formatMonth(report.metrics.lastMonth);

  if (first && last) {
    return first === last ? first : `${first} to ${last}`;
  }

  return "Not available";
}

function formatMonth(value?: string) {
  if (!value) {
    return "";
  }

  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatOptionalCurrency(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "-";
}

function formatLedgerOptionalCurrency(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "";
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function cleanWorkbookName(value: string) {
  return (
    value
      .replace(/\.(xlsx|xls|xlsm)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Workbook"
  );
}

function formatDateLabel(value: string) {
  if (!value) {
    return "Not specified";
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

export default App;
