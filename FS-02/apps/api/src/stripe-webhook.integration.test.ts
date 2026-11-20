import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@aureva/database";

const webhookSecret = "whsec_aureva_integration_test_secret";
const stripe = new Stripe("sk_test_aureva_integration_only");
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const eventIds: string[] = [];
const orderIds: string[] = [];
let app: ReturnType<(typeof import("./app"))["createApp"]>;
let userId = "";
let addressId = "";
let variantId = "";
let vendorId = "";
let productId = "";
let productName = "";
let variantName = "";
let sku = "";
let price = 0;
let initialQuantity = 0;
let initialReserved = 0;
let successfulOrderId = "";
let successfulPaymentId = "";
let successfulIntentId = "";

function eventPayload(id: string, type: string, object: Record<string, unknown>) {
  return JSON.stringify({
    id,
    object: "event",
    created: Math.floor(Date.now() / 1_000),
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  });
}

async function sendSigned(payload: string) {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return request(app).post("/api/v1/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(payload);
}

async function createPendingOrder(intentId: string, includeCartItem: boolean) {
  const order = await prisma.$transaction(async (transaction) => {
    await transaction.inventory.update({ where: { variantId }, data: { reserved: { increment: 1 } } });
    const created = await transaction.order.create({
      data: {
        orderNumber: `AUR-WEBHOOK-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId,
        addressId,
        status: "PENDING_PAYMENT",
        currency: "INR",
        subtotal: price,
        shippingTotal: 0,
        grandTotal: price,
        idempotencyKey: `webhook-order-${randomUUID()}`,
        vendorOrders: {
          create: {
            vendorId,
            status: "PENDING_PAYMENT",
            subtotal: price,
            commissionTotal: Math.round(price * 0.1),
            vendorNet: price - Math.round(price * 0.1),
            items: {
              create: { productId, variantId, productName, variantName, sku, quantity: 1, unitPrice: price, totalPrice: price, currency: "INR" },
            },
          },
        },
        payments: {
          create: { provider: "STRIPE", providerIntentId: intentId, status: "REQUIRES_ACTION", amount: price, currency: "INR", idempotencyKey: `webhook-payment-${randomUUID()}` },
        },
      },
      include: { payments: true },
    });
    await transaction.inventoryReservation.create({ data: { variantId, orderId: created.id, quantity: 1, expiresAt: new Date(Date.now() + 900_000) } });
    if (includeCartItem) {
      const cart = await transaction.cart.upsert({ where: { userId_status: { userId, status: "ACTIVE" } }, create: { userId, status: "ACTIVE" }, update: {} });
      await transaction.cartItem.upsert({ where: { cartId_productVariantId: { cartId: cart.id, productVariantId: variantId } }, create: { cartId: cart.id, productVariantId: variantId, quantity: 1 }, update: { quantity: 1 } });
    }
    return created;
  });
  orderIds.push(order.id);
  return order;
}

describe("signed Stripe webhook lifecycle", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.STRIPE_SECRET_KEY = "sk_test_aureva_integration_only";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const appModule = await import("./app");
    app = appModule.createApp();

    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { isActive: true, product: { status: "ACTIVE" } },
      include: { inventory: true, product: true },
    });
    if (!variant.inventory) throw new Error("Seeded variant has no inventory");
    variantId = variant.id;
    vendorId = variant.product.vendorId;
    productId = variant.productId;
    productName = variant.product.name;
    variantName = variant.name;
    sku = variant.sku;
    price = variant.price;
    initialQuantity = variant.inventory.quantity;
    initialReserved = variant.inventory.reserved;

    const user = await prisma.user.create({
      data: {
        email: `webhook-${runId}@example.com`,
        name: "Webhook Integration Customer",
        passwordHash: "not-used-by-this-test",
        roles: ["CUSTOMER"],
        emailVerifiedAt: new Date(),
        customerProfile: { create: {} },
        addresses: {
          create: { label: "Test", name: "Webhook Customer", line1: "1 Integration Lane", city: "Bengaluru", state: "Karnataka", postalCode: "560001", countryCode: "IN", phone: "+919999999999", isDefault: true },
        },
      },
      include: { addresses: true },
    });
    userId = user.id;
    addressId = user.addresses[0]!.id;
  });

  afterAll(async () => {
    await prisma.paymentEvent.deleteMany({ where: { providerEventId: { in: eventIds } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (variantId) await prisma.inventory.update({ where: { variantId }, data: { quantity: initialQuantity, reserved: initialReserved } });
  });

  it("accepts a valid success event and ignores its duplicate", async () => {
    successfulIntentId = `pi_success_${runId}`;
    const order = await createPendingOrder(successfulIntentId, true);
    successfulOrderId = order.id;
    successfulPaymentId = order.payments[0]!.id;
    const eventId = `evt_success_${runId}`;
    eventIds.push(eventId);
    const payload = eventPayload(eventId, "payment_intent.succeeded", { id: successfulIntentId, object: "payment_intent", latest_charge: `ch_${runId}` });

    const first = await sendSigned(payload);
    expect(first.status).toBe(200);
    expect(first.body.data.received).toBe(true);

    const [updatedOrder, updatedPayment, inventory, cartItem] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { vendorOrders: true, history: true } }),
      prisma.payment.findUniqueOrThrow({ where: { id: successfulPaymentId } }),
      prisma.inventory.findUniqueOrThrow({ where: { variantId } }),
      prisma.cartItem.findFirst({ where: { cart: { userId }, productVariantId: variantId } }),
    ]);
    expect(updatedOrder.status).toBe("PLACED");
    expect(updatedOrder.vendorOrders.every((vendorOrder) => vendorOrder.status === "PLACED")).toBe(true);
    expect(updatedOrder.history.some((entry) => entry.toStatus === "PLACED")).toBe(true);
    expect(updatedPayment.status).toBe("SUCCEEDED");
    expect(inventory.quantity).toBe(initialQuantity - 1);
    expect(inventory.reserved).toBe(initialReserved);
    expect(cartItem).toBeNull();

    const duplicate = await sendSigned(payload);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.duplicate).toBe(true);
    expect(await prisma.paymentEvent.count({ where: { providerEventId: eventId } })).toBe(1);
  });

  it("releases reserved inventory after a failed payment", async () => {
    const intentId = `pi_failed_${runId}`;
    const order = await createPendingOrder(intentId, false);
    const eventId = `evt_failed_${runId}`;
    eventIds.push(eventId);
    const payload = eventPayload(eventId, "payment_intent.payment_failed", { id: intentId, object: "payment_intent" });

    const response = await sendSigned(payload);
    expect(response.status).toBe(200);
    const [updatedOrder, payment, reservation, inventory] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { vendorOrders: true } }),
      prisma.payment.findFirstOrThrow({ where: { orderId: order.id } }),
      prisma.inventoryReservation.findUniqueOrThrow({ where: { variantId_orderId: { variantId, orderId: order.id } } }),
      prisma.inventory.findUniqueOrThrow({ where: { variantId } }),
    ]);
    expect(updatedOrder.status).toBe("CANCELLED");
    expect(updatedOrder.vendorOrders.every((vendorOrder) => vendorOrder.status === "CANCELLED")).toBe(true);
    expect(payment.status).toBe("FAILED");
    expect(reservation.releasedAt).not.toBeNull();
    expect(inventory.quantity).toBe(initialQuantity - 1);
    expect(inventory.reserved).toBe(initialReserved);
  });

  it("applies a verified partial-refund provider update", async () => {
    const providerRefundId = `re_${runId}`;
    const refund = await prisma.refund.create({
      data: { orderId: successfulOrderId, paymentId: successfulPaymentId, providerRefundId, amount: Math.floor(price / 2), reason: "Integration partial refund", status: "PROCESSING", requestedById: userId },
    });
    const eventId = `evt_refund_${runId}`;
    eventIds.push(eventId);
    const payload = eventPayload(eventId, "refund.updated", { id: providerRefundId, object: "refund", status: "succeeded", failure_reason: null });

    const response = await sendSigned(payload);
    expect(response.status).toBe(200);
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("SUCCEEDED");
  });

  it("rejects an invalid signature", async () => {
    const response = await request(app).post("/api/v1/webhooks/stripe").set("stripe-signature", "invalid").set("content-type", "application/json").send(eventPayload(`evt_invalid_${runId}`, "payment_intent.succeeded", { id: successfulIntentId }));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });
});
