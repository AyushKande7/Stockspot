import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatStorePrice } from "./money";

describe("formatStorePrice", () => {
  it("formats the listed amount in the store's currency", () => {
    assert.ok(formatStorePrice(12.5, "USD").includes("12.50"));
    assert.ok(formatStorePrice(12.5, "EUR").includes("12,50"));
  });

  it("falls back to a currency code instead of failing on invalid codes", () => {
    assert.ok(formatStorePrice(12.5, "BAD").includes("BAD"));
  });
});