export type Currency = { code: string; name: string };

// Most-used first; order drives the dropdown.
export const CURRENCIES: Currency[] = [
  { code: "BRL", name: "Real (BRL)" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Pound" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "AUD", name: "Australian dollar" },
  { code: "SGD", name: "Singapore dollar" },
  { code: "JPY", name: "Yen" },
  { code: "CNY", name: "Chinese Yuan" },
];

export const DEFAULT_CURRENCY_CODE = "BRL";

const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

// Renders value with locale symbol and grouping. Falls back to BRL for unknown codes,
// plain string if Intl throws. precision overrides the currency's natural decimal places.
export function formatCurrency(
  value: number,
  code: string | undefined,
  precision: number | undefined,
): string {
  const currency =
    code && CURRENCY_CODES.has(code) ? code : DEFAULT_CURRENCY_CODE;
  try {
    const locale = currency === "BRL" ? "pt-BR" : undefined;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      ...(precision != null
        ? { minimumFractionDigits: precision, maximumFractionDigits: precision }
        : {}),
    }).format(value);
  } catch {
    return String(value);
  }
}
