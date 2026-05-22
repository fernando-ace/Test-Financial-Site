import { ChangeEvent, useRef } from "react";
import { Download, FileJson, RotateCcw, Trash2, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EditableBudgetRow, MonthlyBudget, createMonthlyBudget, createRow } from "../lib/budgetModel";

interface DataToolsProps {
  budget: MonthlyBudget;
  templateRows: EditableBudgetRow[];
  onImportBudget: (budget: MonthlyBudget) => void;
  onResetTemplate: () => void;
  onClearAll: () => void;
}

export function DataTools({ budget, templateRows, onImportBudget, onResetTemplate, onClearAll }: DataToolsProps) {
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  function exportJson() {
    downloadFile(`budget-${budget.month}.json`, JSON.stringify(budget, null, 2), "application/json");
  }

  function downloadCsv() {
    const header = ["Type", "Category", "Line item", "Planned", "Actual", "Difference"];
    const rows = budget.rows.map((row) => [
      row.type,
      row.category,
      row.name,
      row.planned,
      row.actual,
      row.type === "income" ? row.actual - row.planned : row.planned - row.actual,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    downloadFile(`budget-${budget.month}.csv`, csv, "text/csv");
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as MonthlyBudget;
        if (!Array.isArray(parsed.rows)) {
          throw new Error("Missing rows");
        }

        onImportBudget(createMonthlyBudget(budget.month, parsed.rows.map((row) => createRow(row))));
      } catch {
        window.alert("That JSON file does not look like an exported budget.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Data tools</h2>
          <p className="mt-1 text-sm text-slate-500">Export, import, or reset data without sending anything to a server.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolButton onClick={exportJson} icon={FileJson} label="Export JSON" />
          <ToolButton onClick={() => jsonInputRef.current?.click()} icon={Upload} label="Import JSON" />
          <ToolButton onClick={downloadCsv} icon={Download} label="Download CSV" />
          <ToolButton onClick={onResetTemplate} icon={RotateCcw} label="Reset to template" />
          <ToolButton onClick={onClearAll} icon={Trash2} label="Clear all data" danger />
        </div>
      </div>
      <input ref={jsonInputRef} type="file" accept="application/json,.json" onChange={importJson} className="sr-only" aria-label="Import budget JSON" />
      <p className="mt-3 text-xs text-slate-500">
        Template currently has {templateRows.length} editable starter rows. Your monthly budgets stay private in this browser.
      </p>
    </section>
  );
}

function ToolButton({
  onClick,
  icon: Icon,
  label,
  danger = false,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        danger
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-500"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-teal-500"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
