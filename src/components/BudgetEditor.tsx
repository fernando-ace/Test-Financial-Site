import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { BudgetRowType, EditableBudgetRow, createRow, normalizeAmount } from "../lib/budgetModel";

interface BudgetEditorProps {
  rows: EditableBudgetRow[];
  onRowsChange: (rows: EditableBudgetRow[]) => void;
}

export function BudgetEditor({ rows, onRowsChange }: BudgetEditorProps) {
  const incomeRows = rows.filter((row) => row.type === "income");
  const expenseRows = rows.filter((row) => row.type === "expense");
  const expenseCategories = Array.from(new Set(expenseRows.map((row) => row.category))).filter(Boolean);

  function updateRow(id: string, updates: Partial<EditableBudgetRow>) {
    onRowsChange(
      rows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextType = updates.type ?? row.type;
        return {
          ...row,
          ...updates,
          category:
            updates.type && updates.type !== row.type
              ? nextType === "income"
                ? "Income"
                : expenseCategories[0] ?? "New category"
              : updates.category ?? row.category,
        };
      }),
    );
  }

  function addRow(type: BudgetRowType, category?: string) {
    onRowsChange([
      ...rows,
      createRow({
        type,
        category: category || (type === "income" ? "Income" : expenseCategories[0] ?? "New category"),
      }),
    ]);
  }

  function addCategory() {
    const index = expenseCategories.length + 1;
    onRowsChange([...rows, createRow({ type: "expense", category: `New category ${index}` })]);
  }

  function deleteRow(id: string) {
    onRowsChange(rows.filter((row) => row.id !== id));
  }

  function deleteEmptyCategory(category: string) {
    const hasItems = rows.some((row) => row.type === "expense" && row.category === category);
    if (!hasItems || window.confirm(`Delete the empty category "${category}"?`)) {
      onRowsChange(rows.filter((row) => row.category !== category));
    }
  }

  return (
    <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Enter details</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Add your income, plan expenses, and keep actual spending updated as the month moves along.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => addRow("income")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add income
          </button>
          <button type="button" onClick={addCategory} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add category
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <EditorPanel title="Income" description="Money coming in this month.">
          <div className="space-y-3">
            {incomeRows.length === 0 ? <EmptyEditorState message="No income yet. Add a source to start your budget." /> : null}
            {incomeRows.map((row) => (
              <EditableRow
                key={row.id}
                row={row}
                categoryOptions={["Income", ...expenseCategories]}
                onUpdate={updateRow}
                onDelete={deleteRow}
              />
            ))}
          </div>
        </EditorPanel>

        <EditorPanel title="Expenses" description="Group spending by category and track each line item.">
          <div className="space-y-4">
            {expenseCategories.length === 0 ? <EmptyEditorState message="No expense categories yet. Add one when you are ready to plan spending." /> : null}
            {expenseCategories.map((category) => {
              const categoryRows = expenseRows.filter((row) => row.category === category);

              return (
                <div key={category} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      Category name
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:w-64"
                        value={category}
                        onChange={(event) => {
                          const nextCategory = event.target.value;
                          onRowsChange(rows.map((row) => (row.category === category ? { ...row, category: nextCategory } : row)));
                        }}
                        onBlur={(event) => {
                          if (event.target.value.trim() === "") {
                            onRowsChange(rows.map((row) => (row.category === category ? { ...row, category: "New category" } : row)));
                          }
                        }}
                        aria-label={`Rename category ${category}`}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => addRow("expense", category)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add item
                      </button>
                      {categoryRows.length === 0 ? (
                        <button type="button" onClick={() => deleteEmptyCategory(category)} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2">
                          Delete category
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {category.trim() === "" ? <p className="mt-2 text-xs font-medium text-rose-600">Category name cannot be blank.</p> : null}

                  <div className="mt-3 space-y-3">
                    {categoryRows.map((row) => (
                      <EditableRow
                        key={row.id}
                        row={row}
                        categoryOptions={expenseCategories}
                        onUpdate={updateRow}
                        onDelete={deleteRow}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </EditorPanel>
      </div>
    </section>
  );
}

function EditorPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </article>
  );
}

function EditableRow({
  row,
  categoryOptions,
  onUpdate,
  onDelete,
}: {
  row: EditableBudgetRow;
  categoryOptions: string[];
  onUpdate: (id: string, updates: Partial<EditableBudgetRow>) => void;
  onDelete: (id: string) => void;
}) {
  const hasBlankName = row.name.trim() === "";
  const hasBlankCategory = row.category.trim() === "";

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[110px_minmax(130px,1fr)_minmax(130px,1fr)_120px_120px_auto] md:items-start">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Type
        <select
          value={row.type}
          onChange={(event) => onUpdate(row.id, { type: event.target.value as BudgetRowType })}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          aria-label={`Type for ${row.name}`}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </label>

      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Category
        <select
          value={categoryOptions.includes(row.category) ? row.category : ""}
          onChange={(event) => onUpdate(row.id, { category: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          aria-label={`Category for ${row.name}`}
        >
          {!categoryOptions.includes(row.category) ? <option value={row.category}>{row.category || "Choose category"}</option> : null}
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {hasBlankCategory ? <span className="mt-1 block text-xs normal-case tracking-normal text-rose-600">Category is required.</span> : null}
      </label>

      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Line item
        <input
          value={row.name}
          onChange={(event) => onUpdate(row.id, { name: event.target.value })}
          onBlur={(event) => {
            if (event.target.value.trim() === "") {
              onUpdate(row.id, { name: row.type === "income" ? "Income source" : "New item" });
            }
          }}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          aria-label={`Line item name for ${row.name}`}
        />
        {hasBlankName ? <span className="mt-1 block text-xs normal-case tracking-normal text-rose-600">Line item is required.</span> : null}
      </label>

      <AmountInput label="Planned" value={row.planned} rowName={row.name} onChange={(planned) => onUpdate(row.id, { planned })} />
      <AmountInput label="Actual" value={row.actual} rowName={row.name} onChange={(actual) => onUpdate(row.id, { actual })} />

      <button
        type="button"
        onClick={() => onDelete(row.id)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 md:mt-5"
        aria-label={`Delete ${row.name || "budget row"}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>
    </div>
  );
}

function AmountInput({ label, value, rowName, onChange }: { label: string; value: number; rowName: string; onChange: (value: number) => void }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <span className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
        <span className="mr-1 text-sm text-slate-400">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value === 0 ? "" : value}
          onChange={(event) => onChange(Math.max(0, normalizeAmount(event.target.value)))}
          className="w-full min-w-0 bg-transparent text-sm normal-case tracking-normal text-slate-900 outline-none"
          aria-label={`${label} amount for ${rowName || "budget row"}`}
          placeholder="0"
        />
      </span>
    </label>
  );
}

function EmptyEditorState({ message }: { message: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{message}</p>;
}
