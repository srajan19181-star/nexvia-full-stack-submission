import { z } from "zod";

export const roles = ["CUSTOMER", "VENDOR", "ADMIN"] as const;
export type Role = (typeof roles)[number];

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/);
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const productVariantInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(2).max(64),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("INR"),
  stock: z.number().int().nonnegative(),
  attributes: z.record(z.string(), z.string()).default({}),
});
export const productInputSchema = z.object({
  name: z.string().trim().min(3).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(190),
  description: z.string().trim().min(20).max(20_000),
  categoryId: z.string().cuid(),
  brandId: z.string().cuid().optional().nullable(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("INR"),
  sku: z.string().trim().min(2).max(64),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string().url()).min(1).max(10),
  specifications: z.record(z.string(), z.string()).default({}),
  variants: z.array(productVariantInputSchema).min(1).max(50).optional(),
});
export const cartItemSchema = z.object({ productVariantId: z.string().cuid(), quantity: z.number().int().min(1).max(20) });
export const checkoutSchema = z.object({ addressId: z.string().cuid(), couponCode: z.string().trim().max(40).optional() });
export const reservedVendorSlugs = ["analytics", "apply", "commissions", "connect", "coupons", "dashboard", "orders", "payouts", "products", "returns", "reviews", "settings", "uploads"] as const;
const reservedVendorSlugSet = new Set<string>(reservedVendorSlugs);
export const vendorApplicationSchema = z.object({
  storeName: z.string().trim().min(3).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).refine((value) => !reservedVendorSlugSet.has(value), "This storefront path is reserved"),
  description: z.string().trim().min(30).max(2000),
  legalName: z.string().trim().min(2).max(160),
  taxIdentifier: z.string().trim().min(4).max(64),
});
export const addressSchema = z.object({
  label: z.string().trim().min(2).max(30), name: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(160), line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20), countryCode: z.string().length(2).default("IN"),
  phone: z.string().trim().min(7).max(20), isDefault: z.boolean().default(false),
});
export const couponSchema = z.object({ code: z.string().trim().toUpperCase().min(3).max(40) });
export const reviewSchema = z.object({ productId: z.string().cuid(), rating: z.number().int().min(1).max(5), title: z.string().trim().max(100), body: z.string().trim().min(10).max(2000) });
export const returnRequestSchema = z.object({
  reason: z.enum(["DAMAGED", "NOT_AS_DESCRIBED", "WRONG_ITEM", "CHANGED_MIND", "OTHER"]),
  details: z.string().trim().min(10).max(3000),
  evidence: z.array(z.string().url()).max(6).default([]),
  items: z.array(z.object({ orderItemId: z.string().cuid(), quantity: z.number().int().min(1).max(20), reason: z.string().trim().max(300).optional() })).min(1).max(20),
});
export const disputeSchema = z.object({ subject: z.string().trim().min(3).max(120), details: z.string().trim().min(20).max(5000) });
export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(5000),
  category: z.enum(["GENERAL", "ORDER", "PAYMENT", "RETURN", "ACCOUNT"]).default("GENERAL"),
  orderId: z.string().cuid().optional().nullable(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});
export const supportMessageSchema = z.object({ body: z.string().trim().min(1).max(5000) });
export const vendorSettingsSchema = z.object({
  storeName: z.string().trim().min(3).max(100), description: z.string().trim().min(30).max(2000),
  supportEmail: emailSchema.optional().nullable(), logoUrl: z.string().url().optional().nullable(), bannerUrl: z.string().url().optional().nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), returnPolicy: z.string().trim().max(5000).optional().nullable(),
  processingDays: z.number().int().min(1).max(30),
  shippingRules: z.object({ flatRate: z.number().int().nonnegative(), freeShippingThreshold: z.number().int().nonnegative().nullable() }),
});
const managedCouponFields = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/), type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().int().positive(), minimumOrder: z.number().int().nonnegative(), maximumDiscount: z.number().int().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(), perUserLimit: z.number().int().positive().max(100),
  startsAt: z.coerce.date(), expiresAt: z.coerce.date(), active: z.boolean(),
});
export const managedCouponSchema = managedCouponFields.extend({
  minimumOrder: managedCouponFields.shape.minimumOrder.default(0),
  perUserLimit: managedCouponFields.shape.perUserLimit.default(1),
  active: managedCouponFields.shape.active.default(true),
}).refine((value) => value.expiresAt > value.startsAt, { message: "Expiry must be after the start date", path: ["expiresAt"] });
export const managedCouponUpdateSchema = managedCouponFields.partial().superRefine((value, context) => {
  if (value.startsAt && value.expiresAt && value.expiresAt <= value.startsAt) context.addIssue({ code: "custom", message: "Expiry must be after the start date", path: ["expiresAt"] });
});
export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(100), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  description: z.string().trim().max(1000).optional().nullable(), imageUrl: z.string().url().optional().nullable(), parentId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true), sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const categoryAttributeSchema = z.object({ name: z.string().trim().min(2).max(80), type: z.enum(["TEXT", "NUMBER", "SELECT", "BOOLEAN"]), options: z.array(z.string().trim().min(1).max(80)).max(100).default([]), required: z.boolean().default(false) });
export const newsletterSchema = z.object({ email: emailSchema });

export const orderTransitions = {
  PENDING_PAYMENT: ["PLACED", "CANCELLED"], PLACED: ["PACKED", "CANCELLED"], PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"], DELIVERED: ["RETURNED"], RETURNED: ["REFUNDED"], REFUNDED: [], CANCELLED: [],
} as const;
export type OrderStatus = keyof typeof orderTransitions;
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean { return (orderTransitions[from] as readonly string[]).includes(to); }
export function calculateCommission(subtotal: number, basisPoints: number): number { return Math.round((subtotal * basisPoints) / 10_000); }
export function calculateCouponDiscount(eligibleSubtotal: number, coupon: { type: "PERCENTAGE" | "FIXED"; value: number; maximumDiscount?: number | null }): number {
  const raw = coupon.type === "PERCENTAGE" ? Math.round(eligibleSubtotal * coupon.value / 10_000) : Math.min(coupon.value, eligibleSubtotal);
  return Math.max(0, Math.min(eligibleSubtotal, coupon.maximumDiscount ? Math.min(raw, coupon.maximumDiscount) : raw));
}
export function calculateShipping(subtotal: number, rules: { flatRate?: number; freeShippingThreshold?: number | null }): number {
  if (rules.freeShippingThreshold !== null && rules.freeShippingThreshold !== undefined && subtotal >= rules.freeShippingThreshold) return 0;
  return Math.max(0, Number(rules.flatRate ?? 0));
}
export function allocateAmount(total: number, entries: Array<{ id: string; weight: number }>): Map<string, number> {
  if (total <= 0 || entries.length === 0) return new Map(entries.map((entry) => [entry.id, 0]));
  const weightTotal = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (weightTotal === 0) return new Map(entries.map((entry) => [entry.id, 0]));
  const shares = entries.map((entry) => {
    const exact = total * Math.max(0, entry.weight) / weightTotal;
    return { id: entry.id, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remainder = total - shares.reduce((sum, share) => sum + share.value, 0);
  for (const share of [...shares].sort((left, right) => right.remainder - left.remainder || left.id.localeCompare(right.id))) {
    if (remainder-- <= 0) break;
    share.value += 1;
  }
  return new Map(shares.map((share) => [share.id, share.value]));
}
export function calculateTax(subtotal: number, discount: number, basisPoints: number): number { return Math.round(Math.max(0, subtotal - discount) * Math.max(0, Math.min(10_000, basisPoints)) / 10_000); }
export function calculateVendorSettlement(subtotal: number, discount: number, shipping: number, commissionBasisPoints: number) {
  const commissionable = Math.max(0, subtotal - discount);
  const commission = calculateCommission(commissionable, commissionBasisPoints);
  return { commissionable, commission, vendorNet: commissionable - commission + Math.max(0, shipping) };
}
export function formatMoney(amount: number, currency = "INR", locale = "en-IN"): string { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 100); }

export type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };
export type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } };
