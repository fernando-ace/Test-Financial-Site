import { useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { BudgetRowType, EditableBudgetRow, createRow, getRowDifference, normalizeAmount } from "../lib/budgetModel";
import { formatSignedCurrency } from "../lib/formatters";

interface BudgetTableProps {
  rows: EditableBudgetRow[];
  onRowsChange: (rows: EditableBudgetRow[]) => void;
}

export function BudgetTable({ rows, onRowsChange }: BudgetTableProps) {
  const [query, setQuery] = useState("");
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const categoryOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.category))).filter(Boolean), [rows]);

  const visibleRows = rows.filter((row) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery === "" ||
      [row.type, row.category, row.name].some((value) => value.toLowerCase().includes(normalizedQuery));
    const hasValue = row.planned !== 0 || row.actual !== 0;

    return matchesQuery && (!hideZeroRows || hasValue);
  });

  function updateRow(id: string, updates: Partial<EditableBudgetRow>) {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  }

  function deleteRow(id: string) {
    onRowsChange(rows.filter((row) => row.id !== id));
  }

  function duplicateRow(row: EditableBudgetRow) {
    onRowsChange([...rows, createRow({ ...row, id: undefined, name: `${row.name} copy`, actual: 0 })]);
  }

  return (
    <section className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Editable budget table</h2>
          <p className="mt-1 text-sm text-slate-500">Search, adjust amounts, move rows, or clean up old line items.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-slate-600">
            Search rows
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:w-72"
              placeholder="Category or item"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={hideZeroRows}
              onChange={(event) => setHideZeroRows(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Hide zero rows
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="border-b border-slate-200 px-3 py-3 font-medium">Type</th>
              <th className="border-b border-slate-200 px-3 py-3 font-medium">Category</th>
              <th className="border-b border-slate-200 px-3 py-3 font-medium">Line item</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Planned</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Actual</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Difference</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No rows match the current filter.
                </td>
              </tr>
            ) : null}
            {visibleRows.map((row) => {
              const difference = getRowDifference(row);
              const hasNameError = row.name.trim() === "";
              const hasCategoryError = row.category.trim() === "";

              return (
                <tr key={row.id} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-3">
                    <select
                      value={row.type}
                      onChange={(event) => updateRow(row.id, { type: event.target.value as BudgetRowType })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      aria-label={`Type for ${row.name}`}
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <select
                      value={categoryOptions.includes(row.category) ? row.category : ""}
                      onChange={(event) => updateRow(row.id, { category: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      aria-label={`Category for ${row.name}`}
                    >
                      {!categoryOptions.includes(row.category) ? <option value={row.category}>{row.category || "Choose category"}</option> : null}
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    {hasCategoryError ? <p className="mt-1 text-xs text-rose-600">Category is required.</p> : null}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <input
                      value={row.name}
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      aria-label={`Line item name for ${row.name}`}
                    />
                    {hasNameError ? <p className="mt-1 text-xs text-rose-600">Line item is required.</p> : null}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <CurrencyInput value={row.planned} onChange={(planned) => updateRow(row.id, { planned })} label={`Planned amount for ${row.name}`} />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <CurrencyInput value={row.actual} onChange={(actual) => updateRow(row.id, { actual })} label={`Actual amount for ${row.name}`} />
                  </td>
                  <td className={`border-b border-slate-100 px-3 py-3 text-right font-semibold ${difference >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatSignedCurrency(difference)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateRow(row)}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                        aria-label={`Duplicate ${row.name || "budget row"}`}
                        title="Duplicate row"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                        aria-label={`Delete ${row.name || "budget row"}`}
                        title="Delete row"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CurrencyInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <label className="flex items-center justify-end rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
      <span className="mr-1 text-slate-400">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value === 0 ? "" : value}
        onChange={(event) => onChange(Math.max(0, normalizeAmount(event.target.value)))}
        className="w-24 bg-transparent text-right outline-none"
        aria-label={label}
        placeholder="0"
      />
    </label>
  );
}
