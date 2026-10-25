import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
  it("finds the cheapest complete one-store basket while respecting requested quantities", () => {
    const [inr] = calculateBasketPlans(products, [
      { productId: "milk", quantity: 2 },
      { productId: "rice", quantity: 1 },
    ]).filter((plan) => plan.currency === "INR");

    assert.equal(inr?.bestSingleStore?.stores[0]?.id, "a");
    assert.equal(inr?.bestSingleStore?.total, 210);
  });

  it("finds a lower split-store plan with its actual item assignments", () => {
    const [inr] = calculateBasketPlans(products, [
      { productId: "milk", quantity: 1 },
      { productId: "rice", quantity: 1 },
    ]).filter((plan) => plan.currency === "INR");

    assert.equal(inr?.lowestSplit?.total, 145);
    assert.deepEqual(inr?.lowestSplit?.stores.map((store) => store.id), ["b", "a"]);
  });

  it("shows a split-store option when no one store has the complete basket", () => {
    const separated: BasketProduct[] = [
      { id: "milk", name: "Milk", unit: "L", listings: [{ id: "milk-a", price: 5, quantity: 2, store: stores.a }] },
      { id: "rice", name: "Rice", unit: "kg", listings: [{ id: "rice-b", price: 4, quantity: 2, store: stores.b }] },
    ];
    const [plan] = calculateBasketPlans(separated, [
      { productId: "milk", quantity: 1 },
      { productId: "rice", quantity: 1 },
    ]);

    assert.equal(plan?.bestSingleStore, null);
    assert.equal(plan?.lowestSplit?.total, 9);
    assert.deepEqual(plan?.lowestSplit?.stores.map((store) => store.id), ["a", "b"]);
  });

  it("does not combine prices denominated in different currencies", () => {
    const plans = calculateBasketPlans(products, [
      { productId: "milk", quantity: 1 },
      { productId: "rice", quantity: 1 },
    ]);

    assert.deepEqual(plans.map((plan) => plan.currency), ["INR", "USD"]);
    assert.equal(plans.find((plan) => plan.currency === "USD")?.lowestSplit?.total, 7);
  });

  it("rejects a basket when a listing cannot fulfill the requested quantity", () => {
    assert.deepEqual(calculateBasketPlans(products, [{ productId: "milk", quantity: 6 }]), []);
  });

  it("returns no basket for a product that has no usable store listing", () => {
    const unavailable: BasketProduct[] = [{ id: "bread", name: "Bread", unit: "pc", listings: [] }];
    assert.deepEqual(calculateBasketPlans(unavailable, [{ productId: "bread", quantity: 1 }]), []);
  });
});