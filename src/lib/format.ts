const eur = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format an amount in EUR for Albanian customers, e.g. "24,90 €". */
export function formatEuro(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(n)) return eur.format(0);
  return eur.format(n).replace(/\s?€/, " €");
}

export function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
