import { EditableBudgetRow, getRowDifference } from "../lib/budgetModel";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface BudgetTableProps {
  rows: EditableBudgetRow[];
}

export function BudgetTable({ rows }: BudgetTableProps) {
  return (
    <details className="source-rows no-print rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-base font-semibold text-slate-950">
        Source rows <span className="font-normal text-slate-500">({rows.length})</span>
      </summary>
      <p className="mt-2 text-sm text-slate-500">Read-only rows parsed from the active Excel workbook.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="border-b border-slate-200 px-3 py-2 font-medium">Type</th>
              <th className="border-b border-slate-200 px-3 py-2 font-medium">Category</th>
              <th className="border-b border-slate-200 px-3 py-2 font-medium">Line item</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">Planned</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">Actual</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="border-b border-slate-100 px-3 py-2 capitalize text-slate-600">{row.type}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.category}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-900">{row.name}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(row.planned)}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(row.actual)}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold text-slate-900">{formatSignedCurrency(getRowDifference(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
