import { BudgetRow } from "../lib/parseBudgetWorkbook";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface BudgetTableProps {
  rows: BudgetRow[];
}

export function BudgetTable({ rows }: BudgetTableProps) {
  const detailRows = rows.filter((row) => !row.isSubtotal && row.type !== "balance");

  return (
    <section className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">Budget details</h2>
        <p className="mt-1 text-sm text-slate-500">A cleaned-up table view of the workbook line items</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="border-b border-slate-200 px-3 py-3 font-medium">Category</th>
              <th className="border-b border-slate-200 px-3 py-3 font-medium">Line item</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Planned</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Actual</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row) => (
              <tr key={row.id} className="group">
                <td className="border-b border-slate-100 px-3 py-3 text-slate-500">{row.section}</td>
                <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="border-b border-slate-100 px-3 py-3 text-right text-slate-700">{formatCurrency(row.planned)}</td>
                <td className="border-b border-slate-100 px-3 py-3 text-right text-slate-700">{formatCurrency(row.actual)}</td>
                <td className={`border-b border-slate-100 px-3 py-3 text-right font-semibold ${row.difference >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatSignedCurrency(row.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
