import { describe, expect, test } from "bun:test";
import { calculateBasketPlans, type BasketProduct } from "./smart-basket";

const stores = {
  a: { id: "a", name: "Market A", currency: "INR" },
  b: { id: "b", name: "Market B", currency: "INR" },
  usd: { id: "usd", name: "Market US", currency: "USD" },
};

const products: BasketProduct[] = [
  {
    id: "milk",
    name: "Milk",
    unit: "L",
    listings: [
      { id: "milk-a", price: 60, quantity: 5, store: stores.a },
      { id: "milk-b", price: 55, quantity: 1, store: stores.b },
      { id: "milk-usd", price: 4, quantity: 5, store: stores.usd },
    ],
  },
  {
    id: "rice",
    name: "Rice",
    unit: "kg",
    listings: [
      { id: "rice-a", price: 90, quantity: 5, store: stores.a },
      { id: "rice-b", price: 110, quantity: 5, store: stores.b },
      { id: "rice-usd", price: 3, quantity: 5, store: stores.usd },
    ],
  },
];

describe("calculateBasketPlans", () => {
  test("finds the cheapest complete one-store basket while respecting requested quantities", () => {
    const [inr] = calculateBasketPlans(products, [
      { productId: "milk", quantity: 2 },
      { productId: "rice", quantity: 1 },
    ]).filter((plan) => plan.currency === "INR");

    expect(inr?.bestSingleStore?.stores[0]?.id).toBe("a");
    expect(inr?.bestSingleStore?.total).toBe(210);
  });

  test("finds a lower split-store plan with its actual item assignments", () => {
    const [inr] = calculateBasketPlans(products, [
      { productId: "milk", quantity: 1 },
      { productId: "rice", quantity: 1 },
    ]).filter((plan) => plan.currency === "INR");

    expect(inr?.lowestSplit?.total).toBe(145);
    expect(inr?.lowestSplit?.stores.map((store) => store.id)).toEqual(["b", "a"]);
  });

  test("does not combine prices denominated in different currencies", () => {
    const plans = calculateBasketPlans(products, [
      { productId: "milk", quantity: 1 },
      { productId: "rice", quantity: 1 },
    ]);

    expect(plans.map((plan) => plan.currency)).toEqual(["INR", "USD"]);
    expect(plans.find((plan) => plan.currency === "USD")?.lowestSplit?.total).toBe(7);
  });

  test("rejects a basket when a listing cannot fulfill the requested quantity", () => {
    expect(calculateBasketPlans(products, [{ productId: "milk", quantity: 6 }])).toEqual([]);
  });

  test("returns no basket for a product that has no usable store listing", () => {
    const unavailable: BasketProduct[] = [{ id: "bread", name: "Bread", unit: "pc", listings: [] }];
    expect(calculateBasketPlans(unavailable, [{ productId: "bread", quantity: 1 }])).toEqual([]);
  });
});