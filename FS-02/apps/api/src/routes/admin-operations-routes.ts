import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "@aureva/database";
import { categoryAttributeSchema, categoryInputSchema, managedCouponSchema, managedCouponUpdateSchema, supportMessageSchema } from "@aureva/shared";
import { authenticate, requireRole } from "../auth";
import { env } from "../config";
import { AppError, asyncRoute, ok, validate } from "../http";
import { z } from "zod";

export const adminOperationsRoutes = Router();
adminOperationsRoutes.use(authenticate, requireRole("ADMIN"));

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const categoryInclude = { parent: { select: { id: true, name: true } }, attributes: true, _count: { select: { products: true, children: true } } } as const;

adminOperationsRoutes.get("/customers",asyncRoute(async(_request,response)=>ok(response,await prisma.user.findMany({where:{roles:{has:"CUSTOMER"}},select:{id:true,name:true,email:true,avatarUrl:true,status:true,emailVerifiedAt:true,createdAt:true,_count:{select:{orders:true,reviews:true,tickets:true}}},orderBy:{createdAt:"desc"}}))));
adminOperationsRoutes.patch("/customers/:id/status",asyncRoute(async(request,response)=>{const {status}=validate(z.object({status:z.enum(["ACTIVE","SUSPENDED"])}),request.body);const user=await prisma.user.findUnique({where:{id:request.params.id as string}});if(!user)throw new AppError(404,"USER_NOT_FOUND","Customer not found");if(user.roles.includes("ADMIN"))throw new AppError(409,"ADMIN_STATUS_PROTECTED","Administrator status cannot be changed here");const value=await prisma.$transaction(async tx=>{const updated=await tx.user.update({where:{id:user.id},data:{status}});if(status==="SUSPENDED")await tx.refreshSession.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});await tx.auditLog.create({data:{actorId:request.user!.id,action:`CUSTOMER_${status}`,entityType:"User",entityId:user.id}});return updated;});return ok(response,value);}));

adminOperationsRoutes.patch("/vendors/:id/commission",asyncRoute(async(request,response)=>{const {basisPoints}=validate(z.object({basisPoints:z.number().int().min(0).max(5000)}),request.body);const result=await prisma.vendor.updateMany({where:{id:request.params.id as string},data:{commissionBasisPoints:basisPoints}});if(!result.count)throw new AppError(404,"VENDOR_NOT_FOUND","Vendor not found");await prisma.auditLog.create({data:{actorId:request.user!.id,action:"VENDOR_COMMISSION_UPDATED",entityType:"Vendor",entityId:request.params.id as string,metadata:{basisPoints}}});return ok(response,{basisPoints});}));

adminOperationsRoutes.get("/analytics",asyncRoute(async(_request,response)=>{const since=new Date(Date.now()-90*86_400_000);const [orders,vendors]=await Promise.all([prisma.order.findMany({where:{createdAt:{gte:since},status:{in:["PLACED","PACKED","SHIPPED","DELIVERED","RETURNED","REFUNDED"]}},select:{createdAt:true,grandTotal:true,discountTotal:true,taxTotal:true,shippingTotal:true,vendorOrders:{select:{commissionTotal:true}}},orderBy:{createdAt:"asc"}}),prisma.vendorOrder.groupBy({by:["vendorId"],where:{createdAt:{gte:since},status:{in:["PLACED","PACKED","SHIPPED","DELIVERED"]}},_sum:{subtotal:true,vendorNet:true},_count:true,orderBy:{_sum:{subtotal:"desc"}},take:10})]);const daily=new Map<string,{date:string;gmv:number;commission:number;orders:number}>();for(const order of orders){const date=order.createdAt.toISOString().slice(0,10);const point=daily.get(date)??{date,gmv:0,commission:0,orders:0};point.gmv+=order.grandTotal;point.commission+=order.vendorOrders.reduce((sum,value)=>sum+value.commissionTotal,0);point.orders++;daily.set(date,point);}const vendorRecords=await prisma.vendor.findMany({where:{id:{in:vendors.map(value=>value.vendorId)}},select:{id:true,storeName:true}});return ok(response,{daily:[...daily.values()],topVendors:vendors.map(value=>({...value,vendor:vendorRecords.find(record=>record.id===value.vendorId)}))});}));

adminOperationsRoutes.get("/coupons",asyncRoute(async(_request,response)=>ok(response,await prisma.coupon.findMany({where:{vendorId:null},include:{_count:{select:{redemptions:true}}},orderBy:{createdAt:"desc"}}))));
adminOperationsRoutes.post("/coupons",asyncRoute(async(request,response)=>{const input=validate(managedCouponSchema,request.body);const coupon=await prisma.coupon.create({data:{...input,vendorId:null}});await prisma.auditLog.create({data:{actorId:request.user!.id,action:"PLATFORM_COUPON_CREATED",entityType:"Coupon",entityId:coupon.id}});return ok(response,coupon,201);}));
adminOperationsRoutes.put("/coupons/:id",asyncRoute(async(request,response)=>{const input=validate(managedCouponUpdateSchema,request.body);const updated=await prisma.coupon.updateMany({where:{id:request.params.id as string,vendorId:null},data:input});if(!updated.count)throw new AppError(404,"COUPON_NOT_FOUND","Platform coupon not found");await prisma.auditLog.create({data:{actorId:request.user!.id,action:"PLATFORM_COUPON_UPDATED",entityType:"Coupon",entityId:request.params.id as string}});return ok(response,await prisma.coupon.findUniqueOrThrow({where:{id:request.params.id as string}}));}));
adminOperationsRoutes.delete("/coupons/:id",asyncRoute(async(request,response)=>{const updated=await prisma.coupon.updateMany({where:{id:request.params.id as string,vendorId:null},data:{active:false}});if(!updated.count)throw new AppError(404,"COUPON_NOT_FOUND","Platform coupon not found");await prisma.auditLog.create({data:{actorId:request.user!.id,action:"PLATFORM_COUPON_DEACTIVATED",entityType:"Coupon",entityId:request.params.id as string}});return ok(response,{active:false});}));

adminOperationsRoutes.get("/categories", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.category.findMany({ include: categoryInclude, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
}));

adminOperationsRoutes.post("/categories", asyncRoute(async (request, response) => {
  const input = validate(categoryInputSchema, request.body);
  if (input.parentId && !await prisma.category.count({ where: { id: input.parentId } })) throw new AppError(422, "PARENT_CATEGORY_INVALID", "Parent category does not exist");
  const category = await prisma.category.create({ data: input, include: categoryInclude });
  await prisma.auditLog.create({ data: { actorId: request.user!.id, action: "CATEGORY_CREATED", entityType: "Category", entityId: category.id } });
  return ok(response, category, 201);
}));

adminOperationsRoutes.put("/categories/:id", asyncRoute(async (request, response) => {
  const input = validate(categoryInputSchema, request.body);
  const id = request.params.id as string;
  if (input.parentId === id) throw new AppError(422, "CATEGORY_CYCLE", "A category cannot be its own parent");
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return ok(response, await prisma.category.update({ where: { id }, data: input, include: categoryInclude }));
}));

adminOperationsRoutes.delete("/categories/:id", asyncRoute(async (request, response) => {
  const id = request.params.id as string;
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  if (category._count.children) throw new AppError(409, "CATEGORY_HAS_CHILDREN", "Move or archive child categories first");
  if (category._count.products) await prisma.category.update({ where: { id }, data: { isActive: false } });
  else await prisma.category.delete({ where: { id } });
  return ok(response, { deleted: !category._count.products, archived: Boolean(category._count.products) });
}));

adminOperationsRoutes.post("/categories/:id/attributes", asyncRoute(async (request, response) => {
  const input = validate(categoryAttributeSchema, request.body);
  if (!await prisma.category.count({ where: { id: request.params.id as string } })) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return ok(response, await prisma.categoryAttribute.create({ data: { ...input, categoryId: request.params.id as string } }), 201);
}));

adminOperationsRoutes.put("/category-attributes/:id", asyncRoute(async (request, response) => {
  const input = validate(categoryAttributeSchema, request.body);
  const attribute = await prisma.categoryAttribute.findUnique({ where: { id: request.params.id as string } });
  if (!attribute) throw new AppError(404, "ATTRIBUTE_NOT_FOUND", "Category attribute not found");
  return ok(response, await prisma.categoryAttribute.update({ where: { id: attribute.id }, data: input }));
}));

adminOperationsRoutes.delete("/category-attributes/:id", asyncRoute(async (request, response) => {
  const deleted = await prisma.categoryAttribute.deleteMany({ where: { id: request.params.id as string } });
  if (!deleted.count) throw new AppError(404, "ATTRIBUTE_NOT_FOUND", "Category attribute not found");
  return ok(response, { deleted: true });
}));

adminOperationsRoutes.get("/returns", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.returnRequest.findMany({ include: { order: { select: { orderNumber: true, status: true, currency: true } }, user: { select: { name: true, email: true } }, reviewer: { select: { name: true } }, items: { include: { orderItem: { include: { vendorOrder: { include: { vendor: { select: { storeName: true } } } } } } } }, refund: true }, orderBy: { createdAt: "desc" } }));
}));

adminOperationsRoutes.post("/returns/:id/decision", asyncRoute(async (request, response) => {
  const input = validate(z.object({ action: z.enum(["APPROVE", "REJECT", "RECEIVE", "CLOSE"]), note: z.string().trim().max(1000).optional() }), request.body);
  const value = await prisma.returnRequest.findUnique({ where: { id: request.params.id as string } });
  if (!value) throw new AppError(404, "RETURN_NOT_FOUND", "Return request not found");
  const allowed = input.action === "APPROVE" ? value.status === "REQUESTED" : input.action === "REJECT" ? value.status === "REQUESTED" : input.action === "RECEIVE" ? ["APPROVED", "IN_TRANSIT"].includes(value.status) : ["REJECTED", "REFUNDED"].includes(value.status);
  if (!allowed) throw new AppError(409, "RETURN_TRANSITION_INVALID", `Cannot ${input.action.toLowerCase()} a ${value.status.toLowerCase()} return`);
  const status = input.action === "APPROVE" ? "APPROVED" : input.action === "REJECT" ? "REJECTED" : input.action === "RECEIVE" ? "RECEIVED" : "CLOSED";
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.returnRequest.update({ where: { id: value.id }, data: { status, resolutionNote: input.note ?? null, reviewerId: request.user!.id, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: request.user!.id, action: `RETURN_${status}`, entityType: "ReturnRequest", entityId: value.id, metadata: { note: input.note ?? null } } });
    await tx.notification.create({ data: { userId: value.userId, type: "RETURN_UPDATE", title: `Return ${status.toLowerCase()}`, message: input.note || `Your return request is now ${status.toLowerCase()}.`, data: { returnRequestId: value.id } } });
    return result;
  });
  return ok(response, updated);
}));

adminOperationsRoutes.post("/returns/:id/refund", asyncRoute(async (request, response) => {
  if (!stripe) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Stripe refunds are not configured");
  const value = await prisma.returnRequest.findUnique({ where: { id: request.params.id as string }, include: { order: { include: { payments: true } }, items: { include: { orderItem: { include: { vendorOrder: { include: { commission: true } } } } } }, refund: true } });
  if (!value) throw new AppError(404, "RETURN_NOT_FOUND", "Return request not found");
  if (value.status !== "RECEIVED") throw new AppError(409, "RETURN_NOT_RECEIVED", "The returned goods must be received before refunding");
  if (value.refund) return ok(response, value.refund);
  const payment = value.order.payments.find((item) => ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(item.status));
  if (!payment?.providerIntentId) throw new AppError(409, "PAYMENT_NOT_REFUNDABLE", "No refundable provider payment was found");
  const amount = value.items.reduce((sum, item) => sum + item.orderItem.unitPrice * item.quantity, 0);
  const refundRecord = await prisma.refund.create({ data: { orderId: value.orderId, paymentId: payment.id, amount, reason: value.reason, status: "PROCESSING", requestedById: value.userId, reviewedById: request.user!.id, returnRequestId: value.id, reviewedAt: new Date() } });
  try {
    const providerRefund = await stripe.refunds.create({ payment_intent: payment.providerIntentId, amount, reason: "requested_by_customer", metadata: { orderId: value.orderId, returnRequestId: value.id, refundId: refundRecord.id } }, { idempotencyKey: `return_${value.id}` });
    const succeeded = providerRefund.status === "succeeded";
    const completed = await prisma.$transaction(async (tx) => {
      const previous = await tx.refund.aggregate({ where: { paymentId: payment.id, status: "SUCCEEDED", id: { not: refundRecord.id } }, _sum: { amount: true } });
      const refundedTotal = (previous._sum.amount ?? 0) + (succeeded ? amount : 0);
      const refund = await tx.refund.update({ where: { id: refundRecord.id }, data: { providerRefundId: providerRefund.id, status: succeeded ? "SUCCEEDED" : "PROCESSING" } });
      if (succeeded) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: refundedTotal >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
        await tx.returnRequest.update({ where: { id: value.id }, data: { status: "REFUNDED" } });
        for (const item of value.items) {
          const commission = item.orderItem.vendorOrder.commission;
          if (commission) {
            const reversal = Math.min(commission.amount - commission.reversedAmount, Math.round(commission.amount * (item.orderItem.unitPrice * item.quantity) / Math.max(1, item.orderItem.vendorOrder.subtotal)));
            if (reversal > 0) await tx.commission.update({ where: { id: commission.id }, data: { reversedAmount: { increment: reversal } } });
          }
        }
        await tx.notification.create({ data: { userId: value.userId, type: "REFUND_SUCCEEDED", title: "Refund issued", message: "Your refund has been sent to the original payment method.", data: { refundId: refund.id, amount } } });
      }
      await tx.auditLog.create({ data: { actorId: request.user!.id, action: "REFUND_SUBMITTED", entityType: "Refund", entityId: refund.id, metadata: { providerRefundId: providerRefund.id, amount } } });
      return refund;
    });
    return ok(response, completed, 201);
  } catch (error) {
    await prisma.refund.update({ where: { id: refundRecord.id }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 500) : "Provider request failed" } });
    throw new AppError(502, "REFUND_PROVIDER_FAILED", "The payment provider could not create the refund");
  }
}));

adminOperationsRoutes.get("/refunds", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.refund.findMany({ include: { order: { select: { orderNumber: true, currency: true } }, requestedBy: { select: { name: true, email: true } }, reviewedBy: { select: { name: true } }, returnRequest: true }, orderBy: { createdAt: "desc" } }));
}));

adminOperationsRoutes.get("/disputes", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.dispute.findMany({ include: { order: { select: { orderNumber: true, status: true, grandTotal: true, currency: true } }, user: { select: { name: true, email: true } }, reviewer: { select: { name: true } } }, orderBy: { createdAt: "desc" } }));
}));

adminOperationsRoutes.post("/disputes/:id/decision", asyncRoute(async (request, response) => {
  const input = validate(z.object({ status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]), resolution: z.string().trim().min(5).max(3000) }), request.body);
  const dispute = await prisma.dispute.findUnique({ where: { id: request.params.id as string } });
  if (!dispute) throw new AppError(404, "DISPUTE_NOT_FOUND", "Dispute not found");
  const updated = await prisma.$transaction(async (tx) => {
    const value = await tx.dispute.update({ where: { id: dispute.id }, data: { status: input.status, resolution: input.resolution, reviewerId: request.user!.id, resolvedAt: ["RESOLVED", "REJECTED"].includes(input.status) ? new Date() : null } });
    await tx.notification.create({ data: { userId: dispute.userId, type: "DISPUTE_UPDATE", title: "Dispute updated", message: input.resolution, data: { disputeId: dispute.id, status: input.status } } });
    await tx.auditLog.create({ data: { actorId: request.user!.id, action: `DISPUTE_${input.status}`, entityType: "Dispute", entityId: dispute.id } });
    return value;
  });
  return ok(response, updated);
}));

adminOperationsRoutes.get("/reviews", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.review.findMany({ include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } }, orderBy: { createdAt: "desc" } }));
}));

adminOperationsRoutes.post("/reviews/:id/moderate", asyncRoute(async (request, response) => {
  const input = validate(z.object({ status: z.enum(["PUBLISHED", "REJECTED"]) }), request.body);
  const review = await prisma.review.findUnique({ where: { id: request.params.id as string } });
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
  const updated = await prisma.$transaction(async (tx) => {
    const value = await tx.review.update({ where: { id: review.id }, data: { status: input.status } });
    const ratings = await tx.review.aggregate({ where: { productId: review.productId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
    await tx.product.update({ where: { id: review.productId }, data: { averageRating: ratings._avg.rating ?? 0, reviewCount: ratings._count } });
    await tx.auditLog.create({ data: { actorId: request.user!.id, action: `REVIEW_${input.status}`, entityType: "Review", entityId: review.id } });
    return value;
  });
  return ok(response, updated);
}));

adminOperationsRoutes.get("/support", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.supportTicket.findMany({ include: { user: { select: { name: true, email: true } }, assignedTo: { select: { name: true } }, order: { select: { orderNumber: true } }, messages: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }));
}));

adminOperationsRoutes.patch("/support/:id", asyncRoute(async (request, response) => {
  const input = validate(z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), assignedToId: z.string().cuid().optional().nullable() }), request.body);
  if (input.assignedToId && !await prisma.user.count({ where: { id: input.assignedToId, roles: { has: "ADMIN" } } })) throw new AppError(422, "ASSIGNEE_INVALID", "Assignee must be an administrator");
  const result = await prisma.supportTicket.updateMany({ where: { id: request.params.id as string }, data: { ...input, resolvedAt: ["RESOLVED", "CLOSED"].includes(input.status) ? new Date() : null } });
  if (!result.count) throw new AppError(404, "TICKET_NOT_FOUND", "Support ticket not found");
  return ok(response, await prisma.supportTicket.findUniqueOrThrow({ where: { id: request.params.id as string } }));
}));

adminOperationsRoutes.post("/support/:id/messages", asyncRoute(async (request, response) => {
  const input = validate(supportMessageSchema.extend({ internal: z.boolean().default(false) }), request.body);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: request.params.id as string } });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Support ticket not found");
  const message = await prisma.$transaction(async (tx) => {
    const value = await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: request.user!.id, body: input.body, internal: input.internal }, include: { author: { select: { name: true } } } });
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status, assignedToId: ticket.assignedToId ?? request.user!.id } });
    if (!input.internal) await tx.notification.create({ data: { userId: ticket.userId, type: "SUPPORT_REPLY", title: "Support replied", message: input.body.slice(0, 180), data: { ticketId: ticket.id } } });
    return value;
  });
  return ok(response, message, 201);
}));

adminOperationsRoutes.get("/admins", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.user.findMany({ where: { roles: { has: "ADMIN" }, status: "ACTIVE" }, select: { id: true, name: true, email: true } }));
}));

adminOperationsRoutes.get("/payouts", asyncRoute(async (_request, response) => {
  return ok(response, await prisma.payout.findMany({ include: { vendor: { include: { payoutAccount: true } }, items: { include: { vendorOrder: { include: { order: { select: { orderNumber: true } } } } } } }, orderBy: { createdAt: "desc" } }));
}));

adminOperationsRoutes.post("/payouts", asyncRoute(async (request, response) => {
  const { vendorId } = validate(z.object({ vendorId: z.string().cuid() }), request.body);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, include: { payoutAccount: true } });
  if (!vendor?.payoutAccount || vendor.payoutAccount.status !== "ACTIVE") throw new AppError(409, "PAYOUT_ACCOUNT_NOT_READY", "The vendor payout account is not active");
  const commerce = await prisma.platformSetting.findUnique({ where: { key: "commerce" } });
  const holdDays = Number((commerce?.value as { payoutHoldDays?: number } | null)?.payoutHoldDays ?? 14);
  const eligibleBefore = new Date(Date.now() - holdDays * 86_400_000);
  const orders = await prisma.vendorOrder.findMany({ where: { vendorId, status: "DELIVERED", updatedAt: { lte: eligibleBefore }, payoutItems: { none: {} } }, include: { commission: true, items: { include: { returnItems: { include: { returnRequest: { include: { refund: true } } } } } } } });
  if (!orders.length) throw new AppError(409, "NO_ELIGIBLE_PAYOUTS", "No delivered orders have cleared the payout hold");
  const payoutAmounts = new Map(orders.map((order) => { const refundedGross=order.items.reduce((sum,item)=>sum+item.returnItems.filter(value=>value.returnRequest.refund?.status==="SUCCEEDED").reduce((itemSum,value)=>itemSum+item.unitPrice*value.quantity,0),0); return [order.id,Math.max(0,order.vendorNet-refundedGross+(order.commission?.reversedAmount??0))]; }));
  const amount = [...payoutAmounts.values()].reduce((sum, value) => sum + value, 0);
  if (amount <= 0) throw new AppError(409, "NO_ELIGIBLE_PAYOUTS", "No positive payout balance is available");
  const payout = await prisma.payout.create({ data: { vendorId, amount, currency: "INR", items: { create: orders.map((order) => ({ vendorOrderId: order.id, amount: payoutAmounts.get(order.id)??0 })).filter(item=>item.amount>0) } }, include: { items: true, vendor: { include: { payoutAccount: true } } } });
  await prisma.auditLog.create({ data: { actorId: request.user!.id, action: "PAYOUT_CREATED", entityType: "Payout", entityId: payout.id, metadata: { amount, orders: orders.length } } });
  return ok(response, payout, 201);
}));

adminOperationsRoutes.post("/payouts/:id/process", asyncRoute(async (request, response) => {
  if (!stripe) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Stripe Connect is not configured");
  const payout = await prisma.payout.findUnique({ where: { id: request.params.id as string }, include: { vendor: { include: { payoutAccount: true } } } });
  if (!payout) throw new AppError(404, "PAYOUT_NOT_FOUND", "Payout not found");
  if (payout.status !== "PENDING") throw new AppError(409, "PAYOUT_ALREADY_PROCESSED", "Only pending payouts can be processed");
  if (!payout.vendor.payoutAccount || payout.vendor.payoutAccount.status !== "ACTIVE") throw new AppError(409, "PAYOUT_ACCOUNT_NOT_READY", "Vendor payout account is not active");
  await prisma.payout.update({ where: { id: payout.id }, data: { status: "PROCESSING" } });
  try {
    const transfer = await stripe.transfers.create({ amount: payout.amount, currency: payout.currency.toLowerCase(), destination: payout.vendor.payoutAccount.providerAccountId, metadata: { payoutId: payout.id, vendorId: payout.vendorId } }, { idempotencyKey: `payout_${payout.id}` });
    const completed = await prisma.payout.update({ where: { id: payout.id }, data: { providerPayoutId: transfer.id, status: "PAID", paidAt: new Date() } });
    await prisma.auditLog.create({ data: { actorId: request.user!.id, action: "PAYOUT_PAID", entityType: "Payout", entityId: payout.id, metadata: { transferId: transfer.id } } });
    return ok(response, completed);
  } catch {
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } });
    throw new AppError(502, "PAYOUT_PROVIDER_FAILED", "The payment provider could not process this payout");
  }
}));

const commerceSchema = z.object({ taxBasisPoints: z.number().int().min(0).max(10_000), returnWindowDays: z.number().int().min(1).max(365), payoutHoldDays: z.number().int().min(0).max(180), supportEmail: z.string().email(), maintenanceMode: z.boolean().default(false) });
adminOperationsRoutes.get("/settings", asyncRoute(async (_request, response) => ok(response, await prisma.platformSetting.findMany({ orderBy: { key: "asc" } }))));
adminOperationsRoutes.put("/settings/commerce", asyncRoute(async (request, response) => {
  const value = validate(commerceSchema, request.body);
  const setting = await prisma.platformSetting.upsert({ where: { key: "commerce" }, create: { key: "commerce", value, description: "Marketplace commerce rules", updatedById: request.user!.id }, update: { value, updatedById: request.user!.id } });
  await prisma.auditLog.create({ data: { actorId: request.user!.id, action: "PLATFORM_SETTINGS_UPDATED", entityType: "PlatformSetting", entityId: setting.id } });
  return ok(response, setting);
}));
