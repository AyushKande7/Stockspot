const REGION_BY_CURRENCY: Record<string, string> = {
  AUD: "en-AU",
  CAD: "en-CA",
  CHF: "de-CH",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  JPY: "ja-JP",
  NZD: "en-NZ",
  SGD: "en-SG",
  USD: "en-US",
  ZAR: "en-ZA",
};

export function formatStorePrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(REGION_BY_CURRENCY[currency] ?? "en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)}`;
  }
}

export function formatStoreNumber(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat(REGION_BY_CURRENCY[currency] ?? "en", {
    maximumFractionDigits: 2,
  }).format(amount);
}