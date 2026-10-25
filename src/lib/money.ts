const REGION_BY_CURRENCY: Record<string, string> = {
  AED: "ar-AE",
  AUD: "en-AU",
  BDT: "bn-BD",
  BRL: "pt-BR",
  CAD: "en-CA",
  CHF: "de-CH",
  CNY: "zh-CN",
  EUR: "de-DE",
  GBP: "en-GB",
  HKD: "zh-HK",
  IDR: "id-ID",
  INR: "en-IN",
  JPY: "ja-JP",
  KRW: "ko-KR",
  MXN: "es-MX",
  MYR: "ms-MY",
  NZD: "en-NZ",
  PKR: "ur-PK",
  SAR: "ar-SA",
  SGD: "en-SG",
  THB: "th-TH",
  TRY: "tr-TR",
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