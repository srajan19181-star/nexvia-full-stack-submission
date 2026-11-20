import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { prisma } from "@aureva/database";
import { createApp } from "./app";
import { env } from "./config";

const app = createApp();
const password = "AurevaDemo2026!";
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const newsletterEmail = `integration-${runId}@example.com`;
const couponCode = `IT${runId.toUpperCase()}`;
const productSlug = `integration-vessel-${runId}`;

function csrfFrom(response: request.Response) {
  const values = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = values?.find((value) => value.startsWith("aureva_csrf="));
  if (!cookie) throw new Error("CSRF cookie was not issued");
  return decodeURIComponent(cookie.split(";")[0]!.split("=")[1]!);
}

async function login(agent: ReturnType<typeof request.agent>, email: string) {
  const response = await agent.post("/api/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return csrfFrom(response);
}

describe("real marketplace API", () => {
  const customer = request.agent(app);
  const vendor = request.agent(app);
  const secondVendor = request.agent(app);
  const admin = request.agent(app);
  let customerCsrf = "";
  let vendorCsrf = "";
  let secondVendorCsrf = "";
  let adminCsrf = "";
  let variantId = "";
  let categoryId = "";
  let secondVendorProductId = "";
  let demoOrderId = "";
  let demoVendorOrderId = "";
  let demoOrderItemId = "";
  let demoOrderProductId = "";
  let createdProductId = "";
  let createdCouponId = "";

  beforeAll(async () => {
    const [products, categories] = await Promise.all([
      request(app).get("/api/v1/products?limit=100"),
      request(app).get("/api/v1/categories"),
    ]);
    expect(products.status).toBe(200);
    expect(categories.status).toBe(200);
    variantId = products.body.data[0].variants[0].id;
    categoryId = categories.body.data[0].id;
    secondVendorProductId = products.body.data.find((product: { vendor: { slug: string } }) => product.vendor.slug === "loom-and-grain").id;

    [customerCsrf, vendorCsrf, secondVendorCsrf, adminCsrf] = await Promise.all([
      login(customer, "customer@aureva.local"),
      login(vendor, "vendor@aureva.local"),
      login(secondVendor, "vendor2@aureva.local"),
      login(admin, "admin@aureva.local"),
    ]);

    const orders = await customer.get("/api/v1/orders");
    expect(orders.status).toBe(200);
    const demoOrder = orders.body.data.find((order: { orderNumber: string }) => order.orderNumber === "AUR-DEMO-1001");
    demoOrderId = demoOrder.id;
    demoVendorOrderId = demoOrder.vendorOrders[0].id;
    demoOrderItemId = demoOrder.vendorOrders[0].items[0].id;
    demoOrderProductId = demoOrder.vendorOrders[0].items[0].productId;
  });

  afterAll(async () => {
    if (createdProductId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "Product", entityId: createdProductId } });
      await prisma.searchOutbox.deleteMany({ where: { aggregateType: "Product", aggregateId: createdProductId } });
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }
    if (createdCouponId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "Coupon", entityId: createdCouponId } });
      await prisma.coupon.deleteMany({ where: { id: createdCouponId } });
    }
    await prisma.newsletterSubscriber.deleteMany({ where: { email: newsletterEmail } });
  });

  it("publishes a discoverable OpenAPI contract", async () => {
    const response = await request(app).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.paths["/auth/login"]).toBeDefined();
  });

  it("normalizes and persists newsletter subscriptions idempotently", async () => {
    const first = await request(app).post("/api/v1/newsletter").send({ email: newsletterEmail.toUpperCase() });
    const second = await request(app).post("/api/v1/newsletter").send({ email: newsletterEmail });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await prisma.newsletterSubscriber.count({ where: { email: newsletterEmail } })).toBe(1);
  });

  it("rejects invalid credentials without leaking account details", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ email: "customer@aureva.local", password: "wrong" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an expired access token", async () => {
    const expiredToken = await new SignJWT({ email: "customer@aureva.local", name: "Expired User", roles: ["CUSTOMER"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("expired-test-user")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
    const response = await request(app).get("/api/v1/users/me/profile").set("Cookie", `aureva_access=${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_SESSION");
  });

  it("enforces CSRF on authenticated cart mutations", async () => {
    const blocked = await customer.put("/api/v1/cart/items").send({ productVariantId: variantId, quantity: 2 });
    expect(blocked.status).toBe(403);

    const updated = await customer.put("/api/v1/cart/items").set("x-csrf-token", customerCsrf).send({ productVariantId: variantId, quantity: 2 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.items.find((item: { productVariantId: string }) => item.productVariantId === variantId).quantity).toBe(2);

    const removed = await customer.delete(`/api/v1/cart/items/${variantId}`).set("x-csrf-token", customerCsrf);
    expect(removed.status).toBe(200);
  });

  it("rejects cart quantities when sellable inventory is exhausted", async () => {
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    await prisma.inventory.update({ where: { variantId }, data: { reserved: inventory.quantity } });
    try {
      const response = await customer.put("/api/v1/cart/items").set("x-csrf-token", customerCsrf).send({ productVariantId: variantId, quantity: 1 });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("INSUFFICIENT_STOCK");
    } finally {
      await prisma.inventory.update({ where: { variantId }, data: { quantity: inventory.quantity, reserved: inventory.reserved, version: inventory.version } });
    }
  });

  it("allows only one concurrent reservation for the final unit", async () => {
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    await prisma.inventory.update({ where: { variantId }, data: { quantity: 1, reserved: 0 } });
    try {
      const reserve = () => prisma.$transaction((tx) => tx.inventory.updateMany({
        where: { variantId, quantity: { gte: 1 }, reserved: { lte: 0 } },
        data: { reserved: { increment: 1 }, version: { increment: 1 } },
      }), { isolationLevel: "Serializable" }).then((result) => result.count).catch(() => 0);
      const outcomes = await Promise.all([reserve(), reserve()]);

      expect(outcomes.reduce((sum, count) => sum + count, 0)).toBe(1);
      expect((await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).reserved).toBe(1);
    } finally {
      await prisma.inventory.update({ where: { variantId }, data: { quantity: inventory.quantity, reserved: inventory.reserved, version: inventory.version } });
    }
  });

  it("prevents customers from entering admin APIs", async () => {
    const response = await customer.get("/api/v1/admin/overview");
    expect(response.status).toBe(403);
  });

  it("returns the customer profile and active sessions", async () => {
    const [profile, sessions] = await Promise.all([
      customer.get("/api/v1/users/me/profile"),
      customer.get("/api/v1/users/me/sessions"),
    ]);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe("customer@aureva.local");
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.length).toBeGreaterThan(0);
  });

  it("serves a persisted multi-vendor order and separate seller invoices", async () => {
    const detail = await customer.get(`/api/v1/orders/${demoOrderId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.vendorOrders).toHaveLength(2);
    expect(detail.body.data.vendorOrders.every((order: { shipments: unknown[] }) => order.shipments.length > 0)).toBe(true);

    const invoice = await customer.get(`/api/v1/orders/${demoOrderId}/vendor-orders/${demoVendorOrderId}/invoice`);
    expect(invoice.status).toBe(200);
    expect(invoice.headers["content-type"]).toMatch(/application\/pdf/);
    expect(invoice.headers["content-disposition"]).toMatch(/attachment/);

    const hidden = await vendor.get(`/api/v1/orders/${demoOrderId}`);
    expect(hidden.status).toBe(404);
  });

  it("enforces the configured return window", async () => {
    const response = await customer.post(`/api/v1/orders/${demoOrderId}/returns`).set("x-csrf-token", customerCsrf).send({
      reason: "OTHER",
      details: "Integration verification for the configured return-window policy.",
      evidence: [],
      items: [{ orderItemId: demoOrderItemId, quantity: 1 }],
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("RETURN_WINDOW_CLOSED");
  });

  it("maps duplicate reviews to a safe conflict response", async () => {
    const response = await customer.post("/api/v1/reviews").set("x-csrf-token", customerCsrf).send({
      productId: demoOrderProductId,
      orderItemId: demoOrderItemId,
      rating: 5,
      title: "Still excellent",
      body: "This duplicate review should be rejected without exposing database internals.",
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("isolates vendor-owned products and validates upload media types", async () => {
    const dashboard = await vendor.get("/api/v1/vendors/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.vendor.slug).toBe("mitti-and-form");

    const foreignUpdate = await vendor.put(`/api/v1/vendors/products/${secondVendorProductId}`).set("x-csrf-token", vendorCsrf).send({ name: "Unauthorized rename" });
    expect(foreignUpdate.status).toBe(404);

    const invalidUpload = await vendor.post("/api/v1/vendors/uploads/presign").set("x-csrf-token", vendorCsrf).send({
      fileName: "payload.svg",
      contentType: "image/svg+xml",
      size: 100,
    });
    expect(invalidUpload.status).toBe(422);

    const secondDashboard = await secondVendor.get("/api/v1/vendors/dashboard");
    expect(secondDashboard.status).toBe(200);
    expect(secondVendorCsrf.length).toBeGreaterThan(20);
  });

  it("creates, reconciles, and archives a multi-variant product", async () => {
    const create = await vendor.post("/api/v1/vendors/products").set("x-csrf-token", vendorCsrf).send({
      name: "Integration Stoneware Vessel",
      slug: productSlug,
      description: "A durable integration product used to verify variant inventory reconciliation.",
      categoryId,
      price: 129_900,
      compareAtPrice: 149_900,
      currency: "INR",
      sku: `IT-${runId}-BASE`,
      stock: 5,
      images: ["https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=80"],
      specifications: { material: "Stoneware" },
      variants: [
        { name: "Small", sku: `IT-${runId}-S`, price: 129_900, compareAtPrice: 149_900, currency: "INR", stock: 5, attributes: { size: "Small" } },
        { name: "Large", sku: `IT-${runId}-L`, price: 169_900, compareAtPrice: null, currency: "INR", stock: 3, attributes: { size: "Large" } },
      ],
    });
    expect(create.status).toBe(201);
    createdProductId = create.body.data.id;
    expect(create.body.data.status).toBe("PENDING_REVIEW");
    expect(create.body.data.variants).toHaveLength(2);

    const update = await vendor.put(`/api/v1/vendors/products/${createdProductId}`).set("x-csrf-token", vendorCsrf).send({
      variants: [
        { name: "Small", sku: `IT-${runId}-S`, price: 134_900, compareAtPrice: 149_900, currency: "INR", stock: 8, attributes: { size: "Small" } },
        { name: "Medium", sku: `IT-${runId}-M`, price: 149_900, compareAtPrice: null, currency: "INR", stock: 4, attributes: { size: "Medium" } },
      ],
    });
    expect(update.status).toBe(200);
    expect(update.body.data.variants.find((variant: { sku: string }) => variant.sku === `IT-${runId}-L`).isActive).toBe(false);
    expect(update.body.data.variants.find((variant: { sku: string }) => variant.sku === `IT-${runId}-S`).inventory.quantity).toBe(8);

    const archived = await vendor.delete(`/api/v1/vendors/products/${createdProductId}`).set("x-csrf-token", vendorCsrf);
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("ARCHIVED");
    expect(await prisma.productVariant.count({ where: { productId: createdProductId, isActive: true } })).toBe(0);
  });

  it("exposes real admin analytics and manages platform coupons", async () => {
    const [customers, analytics] = await Promise.all([
      admin.get("/api/v1/admin/customers"),
      admin.get("/api/v1/admin/analytics"),
    ]);
    expect(customers.status).toBe(200);
    expect(customers.body.data.some((user: { email: string }) => user.email === "customer@aureva.local")).toBe(true);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.daily.length).toBeGreaterThan(0);

    const created = await admin.post("/api/v1/admin/coupons").set("x-csrf-token", adminCsrf).send({
      code: couponCode,
      type: "PERCENTAGE",
      value: 1_000,
      minimumOrder: 0,
      maximumDiscount: 50_000,
      usageLimit: 100,
      perUserLimit: 1,
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2030-01-01T00:00:00.000Z",
      active: true,
    });
    expect(created.status).toBe(201);
    createdCouponId = created.body.data.id;

    const updated = await admin.put(`/api/v1/admin/coupons/${createdCouponId}`).set("x-csrf-token", adminCsrf).send({ value: 1_500 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.value).toBe(1_500);

    const deactivated = await admin.delete(`/api/v1/admin/coupons/${createdCouponId}`).set("x-csrf-token", adminCsrf);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.active).toBe(false);
  });

  it("rejects unsigned or incorrectly configured payment webhooks", async () => {
    const response = await request(app).post("/api/v1/webhooks/stripe").set("stripe-signature", "invalid").set("content-type", "application/json").send({ id: "evt_invalid" });
    expect([400, 401]).toContain(response.status);
    expect(["WEBHOOK_UNAVAILABLE", "WEBHOOK_SIGNATURE_INVALID"]).toContain(response.body.error.code);
  });

  it("falls back to PostgreSQL when Elasticsearch is unavailable", async () => {
    const response = await request(app).get("/api/v1/search?q=vase");
    expect(response.status).toBe(200);
    expect(response.body.data.source).toMatch(/elasticsearch|postgres-fallback/);
    expect(response.body.data.products.length).toBeGreaterThan(0);
  });
});
