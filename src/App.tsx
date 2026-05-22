import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Landmark, Printer, ReceiptText, RefreshCcw, TrendingUp, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BudgetChart } from "./components/BudgetChart";
import { BudgetTable } from "./components/BudgetTable";
import { CategorySection } from "./components/CategorySection";
import { KpiCard } from "./components/KpiCard";
import { EditableBudgetRow, BudgetTotals, calculateBudgetTotals, groupRowsByCategory } from "./lib/budgetModel";
import { formatCurrency, formatSignedCurrency } from "./lib/formatters";
import {
  BudgetWorkbookData,
  convertWorkbookRowsToEditableRows,
  parseBudgetWorkbookFromArrayBuffer,
  parseBudgetWorkbookFromUrl,
} from "./lib/parseBudgetWorkbook";

const workbookPath = `${import.meta.env.BASE_URL}MoneySense-monthly-budget-template-v1.xlsx?v=filled-sample-20260522`;

interface ReportMetadata {
  clientName: string;
  preparedBy: string;
  reportDate: string;
}

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<EditableBudgetRow[]>([]);
  const [workbookData, setWorkbookData] = useState<BudgetWorkbookData | null>(null);
  const [metadata, setMetadata] = useState<ReportMetadata>({
    clientName: "",
    preparedBy: "",
    reportDate: getTodayInputValue(),
  });
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading sample workbook");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSampleWorkbook = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await parseBudgetWorkbookFromUrl(workbookPath);
      setWorkbookData(data);
      setRows(convertWorkbookRowsToEditableRows(data.rows));
      setShowAllCategories(false);
      setStatusMessage("Sample workbook loaded");
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "The sample workbook could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSampleWorkbook();
  }, [loadSampleWorkbook]);

  const totals = useMemo(() => calculateBudgetTotals(rows), [rows]);
  const reportBasis = useMemo(() => getReportBasis(totals), [totals]);
  const categories = useMemo(() => groupRowsByCategory(rows), [rows]);
  const expenseCategories = useMemo(() => categories.filter((category) => category.type === "expense"), [categories]);
  const topCategories = useMemo(() => {
    const sortedCategories = [...expenseCategories].sort((first, second) => {
      const firstValue = reportBasis.hasActualExpenses ? first.actual : first.planned;
      const secondValue = reportBasis.hasActualExpenses ? second.actual : second.planned;
      return secondValue - firstValue;
    });

    return showAllCategories ? sortedCategories : sortedCategories.slice(0, 6);
  }, [expenseCategories, reportBasis.hasActualExpenses, showAllCategories]);
  const insights = useMemo(() => getInsights(expenseCategories, totals, reportBasis.hasActualExpenses), [expenseCategories, totals, reportBasis.hasActualExpenses]);
  const reportDateLabel = formatDateLabel(metadata.reportDate);

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

        const data = parseBudgetWorkbookFromArrayBuffer(reader.result, file.name);
        setWorkbookData(data);
        setRows(convertWorkbookRowsToEditableRows(data.rows));
        setShowAllCategories(false);
        setStatusMessage(`${file.name} loaded locally`);
      } catch (caughtError: unknown) {
        setError(caughtError instanceof Error ? caughtError.message : "The selected workbook could not be parsed.");
      } finally {
        setIsLoading(false);
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setError("The selected workbook could not be read.");
      setIsLoading(false);
      event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  }

  function updateMetadata(field: keyof ReportMetadata, value: string) {
    setMetadata((current) => ({ ...current, [field]: value }));
  }

  function clearCurrentReport() {
    const confirmed = window.confirm(
      "Clear the current report? This removes the workbook data from the page, but does not affect the original Excel file.",
    );

    if (!confirmed) {
      return;
    }

    setRows([]);
    setWorkbookData(null);
    setMetadata({
      clientName: "",
      preparedBy: "",
      reportDate: getTodayInputValue(),
    });
    setShowAllCategories(false);
    setError(null);
    setStatusMessage("Current report cleared. Upload an Excel file or load the sample report.");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4">
        <header className="no-print rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Excel report visualizer</p>
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                  Demo sample available
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Client Financial Snapshot</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Turn private Excel planning sheets into clean client-ready summaries, screenshots, and PDFs.
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">Excel files are parsed locally in your browser for this proof of concept.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
              <ActionButton icon={Upload} label="Upload Excel" onClick={() => fileInputRef.current?.click()} />
              <ActionButton icon={RefreshCcw} label="Load sample" onClick={() => void loadSampleWorkbook()} />
              <ActionButton
                icon={Printer}
                label="Generate Client PDF"
                onClick={() => {
                  if (rows.length > 0) {
                    window.print();
                  }
                }}
                primary
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleWorkbookUpload}
                className="sr-only"
                aria-label="Upload Excel workbook"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
            <ReportField label="Client name" value={metadata.clientName} placeholder="Client or household" onChange={(value) => updateMetadata("clientName", value)} />
            <ReportField label="Prepared by" value={metadata.preparedBy} placeholder="Advisor name" onChange={(value) => updateMetadata("preparedBy", value)} />
            <ReportField label="Report date" type="date" value={metadata.reportDate} onChange={(value) => updateMetadata("reportDate", value)} />
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p role="status">{statusMessage}</p>
            {rows.length > 0 ? (
              <button
                type="button"
                onClick={clearCurrentReport}
                className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                Clear current report
              </button>
            ) : null}
          </div>
        </header>

        <section className="print-only print-report-header">
          <p>Excel report visualizer</p>
          <h1>Client Financial Snapshot</h1>
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
          </dl>
        </section>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}

        {!isLoading && !error && rows.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">No workbook loaded</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              Upload an Excel file to create a client snapshot, or load the sample report to preview the dashboard.
            </p>
          </section>
        ) : null}

        {!isLoading && rows.length > 0 ? (
          <section className="printable-report flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workbook snapshot</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{metadata.clientName || "Client financial summary"}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Source: {workbookData?.workbookName ?? "Workbook"}{workbookData?.sheetName ? `, ${workbookData.sheetName} sheet` : ""}
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 lg:min-w-[420px]">
                  <ReportMetaItem label="Prepared by" value={metadata.preparedBy || "Not specified"} />
                  <ReportMetaItem label="Report date" value={reportDateLabel} />
                  <ReportMetaItem label="Rows parsed" value={String(rows.length)} />
                </div>
              </div>
            </div>

            {!reportBasis.hasActualExpenses ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                Actual spending is not filled in yet, so charts use planned values.
              </div>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Total income" value={totals.totalIncome} icon={Landmark} tone="income" caption="Workbook income basis" />
              <KpiCard label="Planned expenses" value={totals.plannedExpenses} icon={ReceiptText} tone="expense" caption="Planned client outflows" />
              <KpiCard label="Actual expenses" value={totals.actualExpenses} icon={FileSpreadsheet} tone="expense" caption="Actuals in workbook" />
              <KpiCard label="Net cash flow" value={reportBasis.netCashFlow} icon={TrendingUp} tone="balance" signed caption={reportBasis.netCashFlowCaption} />
            </section>

            <BudgetChart categories={categories} totals={totals} hasActualExpenses={reportBasis.hasActualExpenses} />

            <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Top expense categories</h2>
                    <p className="text-sm text-slate-500">
                      Ranked by {reportBasis.hasActualExpenses ? "actual spending" : "planned spending"} for the current workbook.
                    </p>
                  </div>
                  {expenseCategories.length > 6 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories((value) => !value)}
                      className="no-print rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 sm:self-start"
                    >
                      {showAllCategories ? "Show top 6" : "Show all categories"}
                    </button>
                  ) : null}
                </div>
                <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {topCategories.map((category) => (
                    <CategorySection key={category.name} category={category} useActualValues={reportBasis.hasActualExpenses} />
                  ))}
                </div>
              </div>

              <InsightCard insights={insights} hasActualExpenses={reportBasis.hasActualExpenses} />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Advisor notes</h2>
              <div className="mt-3 min-h-24 rounded-lg border border-dashed border-slate-300 bg-slate-50" aria-label="Optional notes area" />
            </section>
          </section>
        ) : null}

        {!isLoading && rows.length > 0 ? <BudgetTable rows={rows} /> : null}
      </div>
    </main>
  );
}

function ActionButton({ icon: Icon, label, onClick, primary = false }: { icon: LucideIcon; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto ${
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
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function ReportMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
      <h2 className="mt-5 text-xl font-semibold text-slate-950">Reading workbook</h2>
      <p className="mt-2 text-sm text-slate-500">Parsing Excel rows locally in this browser.</p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-sm">
      <h2 className="text-lg font-semibold">Workbook could not be loaded</h2>
      <p className="mt-2 text-sm text-rose-700">{message}</p>
    </section>
  );
}

function InsightCard({ insights, hasActualExpenses }: { insights: ReturnType<typeof getInsights>; hasActualExpenses: boolean }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Snapshot insights</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <Insight label="Largest planned category" value={insights.largestPlanned} />
        <Insight label="Largest actual category" value={hasActualExpenses ? insights.largestActual : "Actual spending not filled in"} />
        <Insight label="Planned spending variance" value={insights.variance} />
      </dl>
    </article>
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

function getReportBasis(totals: BudgetTotals) {
  const hasActualExpenses = totals.actualExpenses > 0;
  const expenseBasis = hasActualExpenses ? totals.actualExpenses : totals.plannedExpenses;
  const netCashFlow = totals.totalIncome - expenseBasis;

  return {
    hasActualExpenses,
    expenseBasis,
    netCashFlow,
    netCashFlowCaption: hasActualExpenses ? "Income minus actual expenses" : "Income minus planned expenses",
  };
}

function getInsights(categories: ReturnType<typeof groupRowsByCategory>, totals: BudgetTotals, hasActualExpenses: boolean) {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const largestPlanned = expenseCategories.reduce<(typeof expenseCategories)[number] | null>(
    (largest, category) => (!largest || category.planned > largest.planned ? category : largest),
    null,
  );
  const largestActual = expenseCategories.reduce<(typeof expenseCategories)[number] | null>(
    (largest, category) => (!largest || category.actual > largest.actual ? category : largest),
    null,
  );
  const variance = totals.plannedExpenses - totals.actualExpenses;

  return {
    largestPlanned: largestPlanned ? `${largestPlanned.name} (${formatCurrency(largestPlanned.planned)})` : "No planned expenses found",
    largestActual: largestActual && largestActual.actual > 0 ? `${largestActual.name} (${formatCurrency(largestActual.actual)})` : "No actual expenses found",
    variance: hasActualExpenses
      ? `${formatSignedCurrency(variance)} ${variance >= 0 ? "under planned spending" : "over planned spending"}`
      : "Actual spending not filled in",
  };
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  if (!value) {
    return "Not specified";
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

export default App;
