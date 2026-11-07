import { describe, expect, it } from "vitest";
import { shopTotals, discountPct } from "@/lib/market";

describe("shop totals", () => {
  const shop = { delivery_fee: 30, free_delivery_above: 499 };
  it("charges delivery below the free threshold", () => expect(shopTotals(300, shop, "delivery").total).toBe(330));
  it("waives delivery at or above threshold", () => expect(shopTotals(499, shop, "delivery").delivery).toBe(0));
  it("never charges delivery for pickup", () => expect(shopTotals(100, shop, "pickup").delivery).toBe(0));
  it("LOOP10 gives 10% capped at ₹100", () => {
    expect(shopTotals(400, shop, "pickup", "loop10").discount).toBe(40);
    expect(shopTotals(5000, shop, "pickup", "LOOP10").discount).toBe(100);
  });
  it("discount percent", () => expect(discountPct(75, 100)).toBe(25));
});
