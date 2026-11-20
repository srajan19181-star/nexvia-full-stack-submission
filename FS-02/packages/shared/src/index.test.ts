import { describe, expect, it } from "vitest";
import {
  allocateAmount,
  calculateCommission,
  calculateCouponDiscount,
  calculateShipping,
  calculateTax,
  calculateVendorSettlement,
  canTransitionOrder,
  managedCouponSchema,
  managedCouponUpdateSchema,
  productInputSchema,
  productVariantInputSchema,
  registerSchema,
  vendorApplicationSchema,
} from "./index";

describe("authentication contracts", () => {
  it("normalizes registration emails", () => {
    const result = registerSchema.parse({
      name: "Asha Rao",
      email: "  ASHA@EXAMPLE.COM ",
      password: "StrongPass123",
    });

    expect(result.email).toBe("asha@example.com");
  });

  it("rejects weak registration passwords", () => {
    expect(registerSchema.safeParse({ name: "Asha", email: "a@b.com", password: "weak" }).success).toBe(false);
  });
});

describe("vendor contracts", () => {
  it("rejects storefront paths reserved by vendor APIs", () => {
    const result = vendorApplicationSchema.safeParse({
      storeName: "Dashboard Studio",
      slug: "dashboard",
      description: "A deliberately detailed maker description for schema validation.",
      legalName: "Dashboard Studio Private Limited",
      taxIdentifier: "GSTIN1234",
    });

    expect(result.success).toBe(false);
  });
});

describe("catalog validation", () => {
  it("accepts a valid inventory-backed product variant", () => {
    expect(productVariantInputSchema.safeParse({
      name: "Large / Ochre",
      sku: "VASE-L-OCHRE",
      price: 249_900,
      compareAtPrice: 279_900,
      currency: "INR",
      stock: 12,
      attributes: { size: "Large", color: "Ochre" },
    }).success).toBe(true);
  });

  it("rejects negative stock and more than fifty variants", () => {
    expect(productVariantInputSchema.safeParse({
      name: "Invalid",
      sku: "INVALID-1",
      price: 100,
      stock: -1,
      attributes: {},
    }).success).toBe(false);

    const baseProduct = {
      name: "Hand-thrown ceramic vessel",
      slug: "hand-thrown-ceramic-vessel",
      description: "A detailed artisan product description with enough content.",
      categoryId: "cm12345678901234567890123",
      price: 100,
      sku: "BASE-SKU",
      stock: 1,
      images: ["https://cdn.example.com/product.webp"],
      specifications: {},
    };
    const variants = Array.from({ length: 51 }, (_, index) => ({
      name: `Variant ${index}`,
      sku: `SKU-${index}`,
      price: 100,
      stock: 1,
      attributes: {},
    }));

    expect(productInputSchema.safeParse({ ...baseProduct, variants }).success).toBe(false);
  });
});

describe("coupon validation", () => {
  it("normalizes codes and accepts a valid date range", () => {
    const coupon = managedCouponSchema.parse({
      code: " launch_20 ",
      type: "PERCENTAGE",
      value: 2_000,
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T23:59:59.000Z",
    });

    expect(coupon.code).toBe("LAUNCH_20");
  });

  it("rejects an expiry before the start date", () => {
    const result = managedCouponSchema.safeParse({
      code: "EXPIRED",
      type: "FIXED",
      value: 500,
      startsAt: "2026-12-31T00:00:00.000Z",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a true partial update without requiring dates", () => {
    expect(managedCouponUpdateSchema.parse({ active: false, value: 1_500 })).toEqual({ active: false, value: 1_500 });
  });
});

describe("commerce calculations", () => {
  it("calculates commission in integer minor units", () => {
    expect(calculateCommission(200_000, 1_000)).toBe(20_000);
  });

  it("caps percentage discounts and fixed discounts at the subtotal", () => {
    expect(calculateCouponDiscount(100_000, { type: "PERCENTAGE", value: 2_500, maximumDiscount: 12_000 })).toBe(12_000);
    expect(calculateCouponDiscount(4_000, { type: "FIXED", value: 8_000 })).toBe(4_000);
  });

  it("applies free-shipping thresholds", () => {
    expect(calculateShipping(49_999, { flatRate: 4_900, freeShippingThreshold: 50_000 })).toBe(4_900);
    expect(calculateShipping(50_000, { flatRate: 4_900, freeShippingThreshold: 50_000 })).toBe(0);
  });

  it("allocates every minor unit deterministically", () => {
    const allocation = allocateAmount(10, [
      { id: "vendor-b", weight: 1 },
      { id: "vendor-a", weight: 1 },
      { id: "vendor-c", weight: 1 },
    ]);

    expect([...allocation.values()].reduce((sum, value) => sum + value, 0)).toBe(10);
    expect(allocation.get("vendor-a")).toBe(4);
    expect(allocation.get("vendor-b")).toBe(3);
    expect(allocation.get("vendor-c")).toBe(3);
  });

  it("calculates tax only on the discounted subtotal", () => {
    expect(calculateTax(100_000, 20_000, 1_800)).toBe(14_400);
  });

  it("keeps shipping outside the commission base", () => {
    expect(calculateVendorSettlement(100_000, 10_000, 5_000, 1_000)).toEqual({
      commissionable: 90_000,
      commission: 9_000,
      vendorNet: 86_000,
    });
  });
});

describe("order state machine", () => {
  it("allows only valid transitions", () => {
    expect(canTransitionOrder("PLACED", "PACKED")).toBe(true);
    expect(canTransitionOrder("PLACED", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("REFUNDED", "PLACED")).toBe(false);
  });
});
