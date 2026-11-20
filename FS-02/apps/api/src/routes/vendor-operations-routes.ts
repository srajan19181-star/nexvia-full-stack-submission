import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "@aureva/database";
import { managedCouponSchema, managedCouponUpdateSchema, vendorSettingsSchema } from "@aureva/shared";
import { authenticate, requireRole } from "../auth";
import { env } from "../config";
import { AppError, asyncRoute, ok, validate } from "../http";

export const vendorOperationsRoutes = Router();
vendorOperationsRoutes.use(authenticate, requireRole("VENDOR", "ADMIN"));

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

async function ownVendor(userId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: userId }, include: { payoutAccount: true } });
  if (!vendor) throw new AppError(403, "VENDOR_REQUIRED", "Vendor profile required");
  return vendor;
}

vendorOperationsRoutes.get("/settings", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  return ok(response, vendor);
}));

vendorOperationsRoutes.put("/settings", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const input = validate(vendorSettingsSchema, request.body);
  const updated = await prisma.$transaction(async (tx) => {
    const value = await tx.vendor.update({ where: { id: vendor.id }, data: input });
    await tx.auditLog.create({ data: { actorId: request.user!.id, action: "VENDOR_SETTINGS_UPDATED", entityType: "Vendor", entityId: vendor.id } });
    return value;
  });
  return ok(response, updated);
}));

vendorOperationsRoutes.get("/analytics", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [orders, products] = await Promise.all([
    prisma.vendorOrder.findMany({ where: { vendorId: vendor.id, createdAt: { gte: since } }, include: { items: true }, orderBy: { createdAt: "asc" } }),
    prisma.product.findMany({ where: { vendorId: vendor.id }, select: { id: true, name: true, status: true, variants: { select: { inventory: true } } } }),
  ]);
  const daily = new Map<string, { date: string; orders: number; revenue: number }>();
  const topProducts = new Map<string, { productId: string; name: string; units: number; revenue: number }>();
  for (const order of orders) {
    const date = order.createdAt.toISOString().slice(0, 10);
    const point = daily.get(date) ?? { date, orders: 0, revenue: 0 };
    point.orders += 1;
    if (["PLACED", "PACKED", "SHIPPED", "DELIVERED"].includes(order.status)) point.revenue += order.vendorNet;
    daily.set(date, point);
    for (const item of order.items) {
      const product = topProducts.get(item.productId) ?? { productId: item.productId, name: item.productName, units: 0, revenue: 0 };
      product.units += item.quantity;
      product.revenue += item.totalPrice;
      topProducts.set(item.productId, product);
    }
  }
  return ok(response, {
    daily: [...daily.values()],
    topProducts: [...topProducts.values()].sort((a, b) => b.units - a.units).slice(0, 10),
    inventory: products.map((product) => ({ id: product.id, name: product.name, status: product.status, stock: product.variants.reduce((sum, variant) => sum + (variant.inventory?.quantity ?? 0), 0) })),
  });
}));

vendorOperationsRoutes.get("/coupons", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  return ok(response, await prisma.coupon.findMany({ where: { vendorId: vendor.id }, include: { _count: { select: { redemptions: true } } }, orderBy: { createdAt: "desc" } }));
}));

vendorOperationsRoutes.post("/coupons", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const input = validate(managedCouponSchema, request.body);
  const coupon = await prisma.coupon.create({ data: { ...input, vendorId: vendor.id } });
  await prisma.auditLog.create({ data: { actorId: request.user!.id, action: "COUPON_CREATED", entityType: "Coupon", entityId: coupon.id } });
  return ok(response, coupon, 201);
}));

vendorOperationsRoutes.put("/coupons/:id", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const input = validate(managedCouponUpdateSchema, request.body);
  const coupon = await prisma.coupon.findFirst({ where: { id: request.params.id as string, vendorId: vendor.id } });
  if (!coupon) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found");
  return ok(response, await prisma.coupon.update({ where: { id: coupon.id }, data: input }));
}));

vendorOperationsRoutes.delete("/coupons/:id", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const result = await prisma.coupon.updateMany({ where: { id: request.params.id as string, vendorId: vendor.id }, data: { active: false } });
  if (!result.count) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found");
  return ok(response, { deactivated: true });
}));

vendorOperationsRoutes.get("/payouts", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const payouts = await prisma.payout.findMany({ where: { vendorId: vendor.id }, include: { items: { include: { vendorOrder: { select: { id: true, order: { select: { orderNumber: true } } } } } } }, orderBy: { createdAt: "desc" } });
  const eligible = await prisma.vendorOrder.aggregate({ where: { vendorId: vendor.id, status: "DELIVERED", payoutItems: { none: {} } }, _sum: { vendorNet: true }, _count: true });
  return ok(response, { account: vendor.payoutAccount, eligible: { amount: eligible._sum.vendorNet ?? 0, orders: eligible._count }, payouts });
}));

vendorOperationsRoutes.post("/connect/onboarding", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  if (vendor.status !== "APPROVED") throw new AppError(403, "VENDOR_NOT_APPROVED", "Vendor approval is required before payout onboarding");
  if (!stripe) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Stripe Connect is not configured");
  let providerAccountId = vendor.payoutAccount?.providerAccountId;
  if (!providerAccountId) {
    const account = await stripe.accounts.create({ type: "express", country: "IN", email: request.user!.email, business_type: "company", capabilities: { transfers: { requested: true } }, metadata: { vendorId: vendor.id } });
    providerAccountId = account.id;
    await prisma.vendorPayoutAccount.create({ data: { vendorId: vendor.id, provider: "STRIPE_CONNECT", providerAccountId, status: account.details_submitted ? "ACTIVE" : "PENDING" } });
  }
  const link = await stripe.accountLinks.create({
    account: providerAccountId,
    type: "account_onboarding",
    return_url: env.STRIPE_CONNECT_RETURN_URL ?? `${env.WEB_URL}/vendor-portal/payouts?connect=complete`,
    refresh_url: env.STRIPE_CONNECT_REFRESH_URL ?? `${env.WEB_URL}/vendor-portal/payouts?connect=refresh`,
  });
  return ok(response, { url: link.url, expiresAt: link.expires_at });
}));

vendorOperationsRoutes.get("/returns", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const values = await prisma.returnRequest.findMany({
    where: { items: { some: { orderItem: { vendorOrder: { vendorId: vendor.id } } } } },
    include: { order: { select: { orderNumber: true, createdAt: true } }, user: { select: { name: true, email: true } }, items: { where: { orderItem: { vendorOrder: { vendorId: vendor.id } } }, include: { orderItem: true } }, refund: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(response, values);
}));

vendorOperationsRoutes.get("/reviews",asyncRoute(async(request,response)=>{const vendor=await ownVendor(request.user!.id);return ok(response,await prisma.review.findMany({where:{product:{vendorId:vendor.id}},include:{user:{select:{name:true,avatarUrl:true}},product:{select:{name:true,slug:true}}},orderBy:{createdAt:"desc"}}));}));

vendorOperationsRoutes.get("/commissions",asyncRoute(async(request,response)=>{const vendor=await ownVendor(request.user!.id);const [items,totals]=await Promise.all([prisma.commission.findMany({where:{vendorId:vendor.id},include:{vendorOrder:{include:{order:{select:{orderNumber:true,createdAt:true,status:true}}}}},orderBy:{createdAt:"desc"},take:100}),prisma.commission.aggregate({where:{vendorId:vendor.id},_sum:{subtotal:true,amount:true,reversedAmount:true}})]);return ok(response,{basisPoints:vendor.commissionBasisPoints,totals:totals._sum,items});}));
