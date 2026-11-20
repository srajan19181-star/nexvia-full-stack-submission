import { Router } from "express";
import { prisma } from "@aureva/database";
import { disputeSchema, returnRequestSchema, supportMessageSchema } from "@aureva/shared";
import { authenticate } from "../auth";
import { AppError, asyncRoute, ok, validate } from "../http";
import { z } from "zod";

export const customerOperationsRoutes = Router();
customerOperationsRoutes.use(authenticate);

const returnInclude = {
  order: { select: { orderNumber: true, status: true, currency: true, createdAt: true } },
  items: { include: { orderItem: true } },
  refund: true,
} as const;

customerOperationsRoutes.get("/returns", asyncRoute(async (request, response) => {
  return ok(response, await prisma.returnRequest.findMany({ where: { userId: request.user!.id }, include: returnInclude, orderBy: { createdAt: "desc" } }));
}));

customerOperationsRoutes.post("/orders/:id/returns", asyncRoute(async (request, response) => {
  const input = validate(returnRequestSchema, request.body);
  if (new Set(input.items.map((item) => item.orderItemId)).size !== input.items.length) throw new AppError(422, "DUPLICATE_RETURN_ITEM", "Each order item can appear only once");
  const order = await prisma.order.findFirst({
    where: { id: request.params.id as string, userId: request.user!.id },
    include: { vendorOrders: { include: { items: true } }, returnRequests: { where: { status: { notIn: ["REJECTED", "CLOSED"] } }, include: { items: true } } },
  });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  if (order.status !== "DELIVERED") throw new AppError(409, "RETURN_NOT_AVAILABLE", "Returns are available after delivery");
  const commerce = await prisma.platformSetting.findUnique({ where: { key: "commerce" } });
  const returnWindowDays = Number((commerce?.value as { returnWindowDays?: number } | null)?.returnWindowDays ?? 30);
  const deliveredAt = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, toStatus: "DELIVERED" }, orderBy: { createdAt: "desc" } });
  if (deliveredAt && deliveredAt.createdAt.getTime() + returnWindowDays * 86_400_000 < Date.now()) throw new AppError(409, "RETURN_WINDOW_CLOSED", `The ${returnWindowDays}-day return window has closed`);
  const orderItems = new Map(order.vendorOrders.flatMap((vendorOrder) => vendorOrder.items).map((item) => [item.id, item]));
  for (const requested of input.items) {
    const item = orderItems.get(requested.orderItemId);
    if (!item) throw new AppError(422, "RETURN_ITEM_INVALID", "A selected item does not belong to this order");
    const alreadyRequested = order.returnRequests.flatMap((value) => value.items).filter((value) => value.orderItemId === item.id).reduce((sum, value) => sum + value.quantity, 0);
    if (requested.quantity + alreadyRequested > item.quantity) throw new AppError(422, "RETURN_QUANTITY_INVALID", `Return quantity exceeds the purchased quantity for ${item.productName}`);
  }
  const created = await prisma.$transaction(async (tx) => {
    const value = await tx.returnRequest.create({ data: { orderId: order.id, userId: request.user!.id, reason: input.reason, details: input.details, evidence: input.evidence, items: { create: input.items } }, include: returnInclude });
    await tx.auditLog.create({ data: { actorId: request.user!.id, action: "RETURN_REQUESTED", entityType: "ReturnRequest", entityId: value.id, metadata: { orderId: order.id } } });
    return value;
  });
  return ok(response, created, 201);
}));

customerOperationsRoutes.post("/returns/:id/shipment", asyncRoute(async (request, response) => {
  const input = validate(z.object({ carrier: z.string().trim().min(2).max(80), trackingNumber: z.string().trim().min(4).max(120) }), request.body);
  const value = await prisma.returnRequest.findFirst({ where: { id: request.params.id as string, userId: request.user!.id } });
  if (!value) throw new AppError(404, "RETURN_NOT_FOUND", "Return request not found");
  if (value.status !== "APPROVED") throw new AppError(409, "RETURN_SHIPMENT_NOT_ALLOWED", "This return is not ready for shipment");
  return ok(response, await prisma.returnRequest.update({ where: { id: value.id }, data: { status: "IN_TRANSIT", returnCarrier: input.carrier, returnTrackingNumber: input.trackingNumber, shippedAt: new Date() }, include: returnInclude }));
}));

customerOperationsRoutes.get("/disputes", asyncRoute(async (request, response) => {
  return ok(response, await prisma.dispute.findMany({ where: { userId: request.user!.id }, include: { order: { select: { orderNumber: true, status: true, grandTotal: true, currency: true } } }, orderBy: { createdAt: "desc" } }));
}));

customerOperationsRoutes.post("/orders/:id/disputes", asyncRoute(async (request, response) => {
  const input = validate(disputeSchema, request.body);
  const order = await prisma.order.findFirst({ where: { id: request.params.id as string, userId: request.user!.id } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  if (order.status === "PENDING_PAYMENT") throw new AppError(409, "DISPUTE_NOT_AVAILABLE", "A dispute cannot be opened before payment is confirmed");
  const value = await prisma.dispute.create({ data: { ...input, orderId: order.id, userId: request.user!.id } });
  await prisma.auditLog.create({ data: { actorId: request.user!.id, action: "DISPUTE_OPENED", entityType: "Dispute", entityId: value.id, metadata: { orderId: order.id } } });
  return ok(response, value, 201);
}));

customerOperationsRoutes.get("/support", asyncRoute(async (request, response) => {
  return ok(response, await prisma.supportTicket.findMany({ where: { userId: request.user!.id }, include: { order: { select: { orderNumber: true } }, messages: { where: { internal: false }, include: { author: { select: { name: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } }));
}));

customerOperationsRoutes.get("/support/:id", asyncRoute(async (request, response) => {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: request.params.id as string, userId: request.user!.id }, include: { order: { select: { orderNumber: true } }, messages: { where: { internal: false }, include: { author: { select: { name: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Support ticket not found");
  return ok(response, ticket);
}));

customerOperationsRoutes.post("/support/:id/messages", asyncRoute(async (request, response) => {
  const input = validate(supportMessageSchema, request.body);
  const ticket = await prisma.supportTicket.findFirst({ where: { id: request.params.id as string, userId: request.user!.id } });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Support ticket not found");
  if (ticket.status === "CLOSED") throw new AppError(409, "TICKET_CLOSED", "Closed tickets cannot receive new messages");
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: request.user!.id, body: input.body }, include: { author: { select: { name: true, avatarUrl: true } } } });
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: ticket.status === "RESOLVED" ? "OPEN" : ticket.status } });
    return created;
  });
  return ok(response, message, 201);
}));

customerOperationsRoutes.patch("/notifications/:id/read", asyncRoute(async (request, response) => {
  const result = await prisma.notification.updateMany({ where: { id: request.params.id as string, userId: request.user!.id }, data: { readAt: new Date() } });
  if (!result.count) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  return ok(response, { read: true });
}));

customerOperationsRoutes.post("/notifications/read-all", asyncRoute(async (request, response) => {
  const result = await prisma.notification.updateMany({ where: { userId: request.user!.id, readAt: null }, data: { readAt: new Date() } });
  return ok(response, { updated: result.count });
}));
