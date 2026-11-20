import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@aureva/database";
import { z } from "zod";
import { env } from "./config";
import { AppError, validate } from "./http";

const carrierEventSchema = z.object({
  eventId: z.string().min(4).max(200),
  trackingNumber: z.string().min(4).max(120),
  status: z.enum(["LABEL_CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "RETURNED"]),
  occurredAt: z.coerce.date(),
  description: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
});

export async function handleCarrierWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!env.CARRIER_WEBHOOK_SECRET || !signature) throw new AppError(400, "CARRIER_WEBHOOK_UNAVAILABLE", "Carrier webhook configuration is incomplete");
  const expected = createHmac("sha256", env.CARRIER_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const received = signature.replace(/^sha256=/, "");
  if (expected.length !== received.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) throw new AppError(401, "CARRIER_SIGNATURE_INVALID", "Carrier webhook signature is invalid");
  const input = validate(carrierEventSchema, JSON.parse(rawBody.toString("utf8")) as unknown);
  if (await prisma.shipmentTrackingEvent.findUnique({ where: { providerEventId: input.eventId } })) return { duplicate: true };
  const shipment = await prisma.shipment.findUnique({ where: { trackingNumber: input.trackingNumber }, include: { vendorOrder: true } });
  if (!shipment) throw new AppError(404, "SHIPMENT_NOT_FOUND", "Shipment tracking number was not found");
  await prisma.$transaction(async (tx) => {
    await tx.shipmentTrackingEvent.create({ data: { shipmentId: shipment.id, providerEventId: input.eventId, status: input.status, description: input.description ?? null, location: input.location ?? null, occurredAt: input.occurredAt, payload: JSON.parse(rawBody.toString("utf8")) } });
    await tx.shipment.update({ where: { id: shipment.id }, data: { status: input.status, lastEventAt: input.occurredAt, ...(input.status === "DELIVERED" ? { deliveredAt: input.occurredAt } : {}) } });
    if (input.status === "DELIVERED") {
      await tx.vendorOrder.update({ where: { id: shipment.vendorOrderId }, data: { status: "DELIVERED" } });
      const remaining = await tx.vendorOrder.count({ where: { orderId: shipment.vendorOrder.orderId, status: { not: "DELIVERED" } } });
      if (!remaining) {
        const order = await tx.order.findUniqueOrThrow({ where: { id: shipment.vendorOrder.orderId } });
        await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
        await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: "DELIVERED", note: "Delivery verified by carrier webhook" } });
        await tx.notification.create({ data: { userId: order.userId, type: "ORDER_DELIVERED", title: "Order delivered", message: `Order ${order.orderNumber} has been delivered.`, data: { orderId: order.id } } });
      }
    }
  });
  return { received: true };
}
