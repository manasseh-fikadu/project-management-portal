export const SUPPORTED_CURRENCIES = ["ETB", "USD", "EUR"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  ETB: "Ethiopian Birr",
  USD: "US Dollar",
  EUR: "Euro",
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  ETB: "ETB",
  USD: "$",
  EUR: "€",
};

export type ExchangeRates = Record<string, number>;

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "ETB",
  opts?: { maximumFractionDigits?: number }
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(amount || 0);
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates
): number | null {
  if (from === to) return amount;

  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;

  return (amount / fromRate) * toRate;
}
