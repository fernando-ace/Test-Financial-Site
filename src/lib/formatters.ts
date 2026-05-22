export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

export function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  if (safeNumber(value) === 0) {
    return formatted;
  }

  return `${value > 0 ? "+" : "-"}${formatted}`;
}

export function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}
