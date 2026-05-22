import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "income" | "expense" | "balance" | "neutral";
  signed?: boolean;
  caption: string;
}

const toneStyles = {
  income: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  expense: "bg-rose-50 text-rose-700 ring-rose-100",
  balance: "bg-sky-50 text-sky-700 ring-sky-100",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function KpiCard({ label, value, icon: Icon, tone, signed = false, caption }: KpiCardProps) {
  const isPositive = value >= 0;

  return (
    <article className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
            {signed ? formatSignedCurrency(value) : formatCurrency(value)}
          </p>
        </div>
        <div className={`rounded-2xl p-3 ring-1 ${toneStyles[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
        {isPositive ? (
          <ArrowUpRight className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-rose-500" aria-hidden="true" />
        )}
        <span>{caption}</span>
      </div>
    </article>
  );
}
