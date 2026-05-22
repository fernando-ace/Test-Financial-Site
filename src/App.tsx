import { ChangeEvent, useMemo, useRef, useState } from "react";
import { CalendarDays, Eraser, FileSpreadsheet, Landmark, Printer, TrendingDown, TrendingUp, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AnnualCashFlowSummary,
  IncomeLadderReport,
  MaturityEvent,
  parseIncomeLadderWorkbookFromArrayBuffer,
} from "./lib/parseIncomeLadderWorkbook";
import { formatCurrency, formatSignedCurrency } from "./lib/formatters";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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

const INITIAL_STATUS = "No workbook loaded. Upload an Income Ladder workbook to generate a client snapshot.";

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

  const reportDateLabel = useMemo(() => formatDateLabel(metadata.reportDate), [metadata.reportDate]);
  const insights = useMemo(() => (report ? getInsights(report) : null), [report]);
  const previewMaturities = useMemo(() => getUpcomingMaturities(report?.maturityEvents ?? [], 10), [report]);
  const printMaturities = useMemo(() => getUpcomingMaturities(report?.maturityEvents ?? [], 6), [report]);
  const printAnnualRows = useMemo(() => report?.annualSummary.slice(0, 10) ?? [], [report]);

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
    setError(null);
    setStatusMessage("Current report cleared from memory.");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4">
        <header className="no-print rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Private workbook report</p>
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
            annualRows={printAnnualRows}
          />
        ) : null}

        <section className="web-report flex min-w-0 flex-col gap-4">
          {isLoading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} /> : null}

          {!isLoading && !error && !report ? <EmptyState /> : null}

          {!isLoading && report && insights ? (
            <section className="flex min-w-0 flex-col gap-4">
              <WorkbookSummary metadata={metadata} report={report} reportDateLabel={reportDateLabel} />

              <section className="kpi-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard label="Total Spending Goal" value={report.metrics.totalSpendingGoal} icon={CalendarDays} caption={formatPeriod(report)} />
                <KpiCard label="Total Net Income" value={report.metrics.totalNetIncome} icon={Landmark} caption="Modeled income over period" />
                <KpiCard label="IRA Distributions" value={report.metrics.totalIraDistributions} icon={FileSpreadsheet} caption="Total modeled IRA distributions" />
                <KpiCard label="CMA Withdrawals" value={report.metrics.totalCmaWithdrawals} icon={Upload} caption="Total modeled CMA withdrawals" />
                <KpiCard label="Total Surplus / Deficit" value={report.metrics.totalSurplusDeficit} icon={TrendingUp} signed caption="Aggregate cash-flow result" />
                <KpiCard label="First Shortfall Month" value={report.metrics.firstShortfallMonth ?? "None found"} icon={TrendingDown} caption={`${report.metrics.shortfallMonthCount} shortfall months`} />
              </section>

              <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
                <AnnualCoverageChart annualSummary={report.annualSummary} />
                <AnnualSurplusPanel annualSummary={report.annualSummary} />
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

function WorkbookSummary({ metadata, report, reportDateLabel }: { metadata: ReportMetadata; report: IncomeLadderReport; reportDateLabel: string }) {
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
          <ReportMetaItem label="Rows parsed" value={String(report.rowsParsed)} />
          <ReportMetaItem label="Period" value={formatPeriod(report)} />
        </div>
      </div>
    </section>
  );
}

function AnnualCoverageChart({ annualSummary }: { annualSummary: AnnualCashFlowSummary[] }) {
  return (
    <article className="chart-card min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">Annual cash-flow coverage</h2>
        <p className="text-sm text-slate-500">Spending goal compared with modeled income, distributions, and withdrawals.</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={annualSummary} margin={{ left: 4, right: 10, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "#f8fafc" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spendingGoal" name="Spending Goal" fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="totalNetIncome" name="Total Net Income" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Line dataKey="iraDistributions" name="IRA Distributions" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
            <Line dataKey="cmaWithdrawals" name="CMA Withdrawals" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
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
                <th className="pl-3 py-2 text-right">Distribution/Withdrawal</th>
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

function InsightPanel({ insights }: { insights: ReturnType<typeof getInsights> }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Snapshot insights</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <Insight label="Report period" value={insights.reportPeriod} />
        <Insight label="First projected shortfall" value={insights.firstShortfallMonth} />
        <Insight label="Shortfall months" value={insights.shortfallMonthCount} />
        <Insight label="Largest annual shortfall" value={insights.largestAnnualShortfall} />
        <Insight label="Total distributions/withdrawals" value={insights.totalDistributionWithdrawals} />
      </dl>
    </article>
  );
}

function CompactPrintReport({
  advisorNotes,
  annualRows,
  insights,
  maturities,
  metadata,
  report,
  reportDateLabel,
}: {
  advisorNotes: string;
  annualRows: AnnualCashFlowSummary[];
  insights: ReturnType<typeof getInsights>;
  maturities: MaturityEvent[];
  metadata: ReportMetadata;
  report: IncomeLadderReport;
  reportDateLabel: string;
}) {
  const notes = advisorNotes.trim();

  return (
    <section className="print-only compact-print-report">
      <header className="compact-print-header print-block">
        <p>Income Ladder Snapshot</p>
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
            <dd>{formatPeriod(report)}</dd>
          </div>
          <div>
            <dt>Rows parsed</dt>
            <dd>{report.rowsParsed}</dd>
          </div>
        </dl>
      </header>

      <section className="compact-print-grid print-block">
        <CompactPrintKpi label="Total Spending Goal" value={formatCurrency(report.metrics.totalSpendingGoal)} />
        <CompactPrintKpi label="Total Net Income" value={formatCurrency(report.metrics.totalNetIncome)} />
        <CompactPrintKpi label="IRA Distributions" value={formatCurrency(report.metrics.totalIraDistributions)} />
        <CompactPrintKpi label="CMA Withdrawals" value={formatCurrency(report.metrics.totalCmaWithdrawals)} />
        <CompactPrintKpi label="Total Surplus / Deficit" value={formatSignedCurrency(report.metrics.totalSurplusDeficit)} />
      </section>

      <section className="compact-print-two-column print-block">
        <article className="compact-print-card compact-print-chart-card print-block">
          <h2>Annual cash-flow coverage</h2>
          <CompactPrintCoverageChart data={annualRows.slice(0, 8)} />
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

      {notes ? (
        <section className="compact-print-card compact-print-notes print-block">
          <h2>Advisor Notes</h2>
          <p>{notes}</p>
        </section>
      ) : null}
    </section>
  );
}

function AnnualSummaryTable({ rows, compact = false }: { rows: AnnualCashFlowSummary[]; compact?: boolean }) {
  return (
    <table className={compact ? "compact-print-table" : "w-full border-collapse text-sm"}>
      <thead>
        <tr>
          <th>Year</th>
          <th className="numeric">Spending Goal</th>
          <th className="numeric">Net Income</th>
          <th className="numeric">IRA Distributions</th>
          <th className="numeric">CMA Withdrawals</th>
          <th className="numeric">Surplus / Deficit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.year}>
            <td>{row.year}</td>
            <td className="numeric">{formatCurrency(row.spendingGoal)}</td>
            <td className="numeric">{formatCurrency(row.totalNetIncome)}</td>
            <td className="numeric">{formatCurrency(row.iraDistributions)}</td>
            <td className="numeric">{formatCurrency(row.cmaWithdrawals)}</td>
            <td className="numeric">{formatSignedCurrency(row.surplusDeficit)}</td>
          </tr>
        ))}
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

function CompactPrintCoverageChart({ data }: { data: AnnualCashFlowSummary[] }) {
  const maxValue = Math.max(...data.flatMap((item) => [item.spendingGoal, item.totalNetIncome]), 1);
  const rowHeight = 24;
  const chartWidth = 560;
  const labelWidth = 54;
  const valueWidth = 74;
  const plotWidth = chartWidth - labelWidth - valueWidth - 18;
  const chartHeight = 30 + data.length * rowHeight;

  return (
    <svg className="compact-print-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Annual cash-flow coverage">
      <text x={chartWidth - 215} y="14" fill="#475569" fontSize="10" fontWeight="800">
        SPENDING
      </text>
      <rect x={chartWidth - 238} y="5" width="16" height="8" rx="4" fill="#0f766e" />
      <text x={chartWidth - 82} y="14" fill="#475569" fontSize="10" fontWeight="800">
        INCOME
      </text>
      <rect x={chartWidth - 106} y="5" width="16" height="8" rx="4" fill="#2563eb" />
      {data.map((item, index) => {
        const y = 27 + index * rowHeight;
        const spendingWidth = Math.max((item.spendingGoal / maxValue) * plotWidth, 4);
        const incomeWidth = Math.max((item.totalNetIncome / maxValue) * plotWidth, 4);

        return (
          <g key={item.year}>
            {index > 0 ? <line x1="0" x2={chartWidth} y1={y - 8} y2={y - 8} stroke="#e2e8f0" strokeWidth="1" /> : null}
            <text x="0" y={y + 7} fill="#334155" fontSize="10" fontWeight="700">
              {item.year}
            </text>
            <rect x={labelWidth} y={y - 1} width={plotWidth} height="7" rx="3.5" fill="#e2e8f0" />
            <rect x={labelWidth} y={y - 1} width={spendingWidth} height="7" rx="3.5" fill="#0f766e" />
            <rect x={labelWidth} y={y + 10} width={plotWidth} height="7" rx="3.5" fill="#e2e8f0" />
            <rect x={labelWidth} y={y + 10} width={incomeWidth} height="7" rx="3.5" fill="#2563eb" />
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

function getInsights(report: IncomeLadderReport) {
  const largestAnnualShortfall = report.annualSummary.reduce<AnnualCashFlowSummary | null>(
    (largest, row) => (row.surplusDeficit < 0 && (!largest || row.surplusDeficit < largest.surplusDeficit) ? row : largest),
    null,
  );
  const totalDistributionWithdrawals = report.metrics.totalIraDistributions + report.metrics.totalCmaWithdrawals;

  return {
    reportPeriod: formatPeriod(report),
    firstShortfallMonth: report.metrics.firstShortfallMonth ?? "None found",
    shortfallMonthCount: `${report.metrics.shortfallMonthCount} month${report.metrics.shortfallMonthCount === 1 ? "" : "s"}`,
    largestAnnualShortfall: largestAnnualShortfall ? `${largestAnnualShortfall.year}: ${formatSignedCurrency(largestAnnualShortfall.surplusDeficit)}` : "None found",
    totalDistributionWithdrawals: formatCurrency(totalDistributionWithdrawals),
  };
}

function getUpcomingMaturities(events: MaturityEvent[], limit: number) {
  const withMaturingAmount = events.filter((event) => event.maturingAmount !== 0);
  const source = withMaturingAmount.length > 0 ? withMaturingAmount : events;

  return source.slice(0, limit);
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
