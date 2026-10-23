import { describe, expect, test } from "bun:test";
import { formatStorePrice } from "./money";

describe("formatStorePrice", () => {
  test("formats the listed amount in the store's currency", () => {
    expect(formatStorePrice(12.5, "USD")).toContain("12.50");
    expect(formatStorePrice(12.5, "EUR")).toContain("12,50");
  });

  test("falls back to a currency code instead of failing on invalid codes", () => {
    expect(formatStorePrice(12.5, "BAD")).toContain("BAD");
  });
});