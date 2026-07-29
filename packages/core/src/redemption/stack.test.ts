import { describe, expect, it } from "vitest";
import { stackRequestHash } from "./stack.ts";

const base = {
  voucherCodes: ["SECOND", "FIRST"],
  customerExternalId: "customer-1",
  externalOrderId: "order-1",
  order: {
    amount: 5_000,
    currency: "SAR",
    items: [
      {
        productId: "product-b",
        collectionId: "collection-1",
        quantity: 1,
        unitPrice: 3_000,
      },
      {
        productId: "product-a",
        quantity: 2,
        unitPrice: 1_000,
      },
    ],
  },
};

describe("stackRequestHash", () => {
  it("is stable across voucher, item, and object-property order", () => {
    const reordered = {
      order: {
        items: [
          {
            unitPrice: 1_000,
            quantity: 2,
            productId: "product-a",
          },
          {
            unitPrice: 3_000,
            quantity: 1,
            collectionId: "collection-1",
            productId: "product-b",
          },
        ],
        currency: "SAR",
        amount: 5_000,
      },
      externalOrderId: "order-1",
      customerExternalId: "customer-1",
      voucherCodes: ["FIRST", "SECOND"],
    };

    expect(stackRequestHash(base)).toBe(stackRequestHash(reordered));
  });

  it("changes when the logical order contents change", () => {
    expect(
      stackRequestHash({
        ...base,
        order: { ...base.order, amount: 5_001 },
      }),
    ).not.toBe(stackRequestHash(base));
  });
});
