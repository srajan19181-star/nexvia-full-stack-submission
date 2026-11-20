import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "@aureva/database";
import { allocateAmount, calculateCouponDiscount, calculateShipping, calculateTax, calculateVendorSettlement, checkoutSchema } from "@aureva/shared";
import { authenticate } from "../auth";
import { env } from "../config";
import { asyncRoute, AppError, ok, validate } from "../http";
import { cartCacheKey, deleteCached } from "../cache";

export const checkoutRoutes = Router();
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

checkoutRoutes.post("/checkout", authenticate, asyncRoute(async (request, response) => {
  const input = validate(checkoutSchema, request.body); const idempotencyKey = request.get("idempotency-key"); if (!idempotencyKey || idempotencyKey.length < 16) throw new AppError(400, "IDEMPOTENCY_REQUIRED", "A unique Idempotency-Key header is required");
  const existing = await prisma.order.findUnique({ where: { idempotencyKey }, include: { payments: true } }); if (existing) { const payment=existing.payments[0]; if(!payment)throw new AppError(409,"PAYMENT_MISSING","The existing checkout has no payment record"); if(!stripe)return ok(response,{order:existing,payment,paymentConfigurationRequired:true},202); let intent=payment.providerIntentId?await stripe.paymentIntents.retrieve(payment.providerIntentId):null; if(!intent){intent=await stripe.paymentIntents.create({amount:existing.grandTotal,currency:existing.currency.toLowerCase(),automatic_payment_methods:{enabled:true},metadata:{orderId:existing.id,paymentId:payment.id}},{idempotencyKey});await prisma.payment.update({where:{id:payment.id},data:{providerIntentId:intent.id}});} return ok(response,{order:existing,payment:{id:payment.id,clientSecret:intent.client_secret,status:intent.status}}); }
  const address = await prisma.address.findFirst({ where: { id: input.addressId, userId: request.user!.id } }); if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
  const cart = await prisma.cart.findUnique({ where: { userId_status: { userId: request.user!.id, status: "ACTIVE" } }, include: { items: { include: { productVariant: { include: { inventory: true, product: { include: { vendor: true } } } } } } } }); if (!cart?.items.length) throw new AppError(400, "EMPTY_CART", "Your cart is empty");
  const transaction = async () => prisma.$transaction(async (tx) => {
    for (const item of cart.items) { const changed = await tx.inventory.updateMany({ where: { variantId: item.productVariantId, quantity: { gte: item.quantity }, reserved: { lte: (item.productVariant.inventory?.quantity ?? 0) - item.quantity } }, data: { reserved: { increment: item.quantity }, version: { increment: 1 } } }); if (!changed.count) throw new AppError(409, "INSUFFICIENT_STOCK", `${item.productVariant.product.name} no longer has enough stock`); }
    const byVendor = new Map<string, typeof cart.items>();
    for (const item of cart.items) { const vendorId = item.productVariant.product.vendorId; byVendor.set(vendorId, [...(byVendor.get(vendorId) ?? []), item]); }
    const subtotal = cart.items.reduce((sum, item) => sum + item.productVariant.price * item.quantity, 0);
    let discountTotal = 0; let coupon = null;
    if (input.couponCode) { coupon = await tx.coupon.findFirst({ where: { code: input.couponCode.toUpperCase(), active: true, startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } } }); const eligibleSubtotal=coupon?.vendorId ? (byVendor.get(coupon.vendorId)??[]).reduce((sum,item)=>sum+item.productVariant.price*item.quantity,0) : subtotal; if (!coupon || eligibleSubtotal < coupon.minimumOrder) throw new AppError(422, "COUPON_INVALID", "Coupon is invalid for this order"); const [used,totalUsed] = await Promise.all([tx.couponRedemption.count({ where: { couponId: coupon.id, userId: request.user!.id } }),tx.couponRedemption.count({where:{couponId:coupon.id}})]); if (used >= coupon.perUserLimit || (coupon.usageLimit!==null&&totalUsed>=coupon.usageLimit)) throw new AppError(422, "COUPON_LIMIT", "Coupon usage limit reached"); discountTotal = calculateCouponDiscount(eligibleSubtotal,coupon); }
    const shippingByVendor=new Map<string,number>(); let shippingTotal=0;
    const vendorSubtotals=new Map<string,number>();
    for(const [vendorId,items] of byVendor){const vendor=items[0]!.productVariant.product.vendor;const rules=vendor.shippingRules as {flatRate?:number;freeShippingThreshold?:number|null};const vendorSubtotal=items.reduce((sum,item)=>sum+item.productVariant.price*item.quantity,0);vendorSubtotals.set(vendorId,vendorSubtotal);const shipping=calculateShipping(vendorSubtotal,rules);shippingByVendor.set(vendorId,shipping);shippingTotal+=shipping;}
    const commerce=await tx.platformSetting.findUnique({where:{key:"commerce"}});const taxBasisPoints=Number((commerce?.value as {taxBasisPoints?:number}|null)?.taxBasisPoints??0);const taxTotal=calculateTax(subtotal,discountTotal,taxBasisPoints);
    const orderNumber = `AUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const order = await tx.order.create({ data: { orderNumber, userId: request.user!.id, addressId: address.id, subtotal, discountTotal, shippingTotal, taxTotal, grandTotal: subtotal - discountTotal + shippingTotal + taxTotal, couponCode: coupon?.code ?? null, idempotencyKey } });
    const allocatedDiscounts=coupon?.vendorId?new Map([...byVendor.keys()].map(vendorId=>[vendorId,coupon!.vendorId===vendorId?discountTotal:0])):allocateAmount(discountTotal,[...vendorSubtotals].map(([id,weight])=>({id,weight})));
    for (const [vendorId, items] of byVendor) { const vendor = items[0]!.productVariant.product.vendor; const vendorSubtotal = vendorSubtotals.get(vendorId)!; const vendorDiscount = allocatedDiscounts.get(vendorId)??0; const vendorShipping=shippingByVendor.get(vendorId)??0; const settlement=calculateVendorSettlement(vendorSubtotal,vendorDiscount,vendorShipping,vendor.commissionBasisPoints); const vendorOrder = await tx.vendorOrder.create({ data: { orderId: order.id, vendorId, subtotal: vendorSubtotal, discountTotal: vendorDiscount, shippingTotal:vendorShipping, commissionTotal: settlement.commission, vendorNet: settlement.vendorNet, items: { create: items.map((item) => ({ productId: item.productVariant.productId, variantId: item.productVariantId, productName: item.productVariant.product.name, variantName: item.productVariant.name, sku: item.productVariant.sku, quantity: item.quantity, unitPrice: item.productVariant.price, totalPrice: item.productVariant.price * item.quantity, currency: item.productVariant.currency })) } } }); await tx.commission.create({ data: { vendorId, vendorOrderId: vendorOrder.id, subtotal: settlement.commissionable, basisPoints: vendor.commissionBasisPoints, amount: settlement.commission, currency: "INR" } }); }
    await tx.inventoryReservation.createMany({ data: cart.items.map((item) => ({ variantId: item.productVariantId, orderId: order.id, quantity: item.quantity, expiresAt: new Date(Date.now() + 15 * 60_000) })) });
    if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: request.user!.id, orderId: order.id, discountAmount: discountTotal } });
    const payment = await tx.payment.create({ data: { orderId: order.id, provider: "STRIPE", amount: order.grandTotal, currency: "INR", idempotencyKey: `pay_${idempotencyKey}` } });
    return { order, payment };
  }, { isolationLevel: "Serializable" });
  let result: Awaited<ReturnType<typeof transaction>> | undefined;
  for(let attempt=0;attempt<3;attempt++){try{result=await transaction();break;}catch(error){if((error as {code?:string}).code!=="P2034"||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));}}
  if(!result)throw new AppError(409,"CHECKOUT_RETRY_REQUIRED","Checkout could not acquire an inventory transaction; retry safely with the same idempotency key");
  if (!stripe) return ok(response, { ...result, paymentConfigurationRequired: true }, 202);
  const intent = await stripe.paymentIntents.create({ amount: result.order.grandTotal, currency: "inr", automatic_payment_methods: { enabled: true }, metadata: { orderId: result.order.id, paymentId: result.payment.id } }, { idempotencyKey });
  await prisma.payment.update({ where: { id: result.payment.id }, data: { providerIntentId: intent.id, status: intent.status === "succeeded" ? "SUCCEEDED" : "REQUIRES_ACTION" } });
  return ok(response, { order: result.order, payment: { id: result.payment.id, clientSecret: intent.client_secret, status: intent.status } }, 201);
}));

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET || !signature) throw new AppError(400, "WEBHOOK_UNAVAILABLE", "Webhook configuration is incomplete");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook signature is invalid");
  }
  if (await prisma.paymentEvent.findUnique({ where: { providerEventId: event.id } })) return { duplicate: true };
  let cartUserId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const object = event.data.object;
    const objectId = "id" in object ? object.id : "";
    const payment = await tx.payment.findFirst({ where: { providerIntentId: objectId } });
    await tx.paymentEvent.create({ data: { paymentId: payment?.id ?? null, providerEventId: event.id, type: event.type, payload: JSON.parse(JSON.stringify(event)), processedAt: new Date() } });
    if (event.type === "account.updated") { const account=object as Stripe.Account; await tx.vendorPayoutAccount.updateMany({where:{providerAccountId:account.id},data:{status:account.details_submitted&&account.payouts_enabled?"ACTIVE":"PENDING"}}); return; }
    if (event.type === "refund.updated" || event.type === "refund.failed") { const providerRefund=object as Stripe.Refund; const status=providerRefund.status==="succeeded"?"SUCCEEDED":providerRefund.status==="failed"?"FAILED":"PROCESSING"; await tx.refund.updateMany({where:{providerRefundId:providerRefund.id},data:{status,failureReason:providerRefund.failure_reason??null}}); return; }
    if (event.type === "transfer.reversed") { const transfer=object as Stripe.Transfer; await tx.payout.updateMany({where:{providerPayoutId:transfer.id},data:{status:"FAILED"}}); return; }
    if (!payment) return;
    const intent = object as Stripe.PaymentIntent;
    if (event.type === "payment_intent.succeeded") { await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", providerPaymentId: intent.latest_charge as string } }); const order = await tx.order.update({ where: { id: payment.orderId }, data: { status: "PLACED", placedAt: new Date() } }); await tx.vendorOrder.updateMany({ where: { orderId: order.id }, data: { status: "PLACED" } }); await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: "PENDING_PAYMENT", toStatus: "PLACED", note: "Payment verified by Stripe" } }); await tx.inventoryReservation.updateMany({ where: { orderId: order.id }, data: { releasedAt: new Date() } }); const reservations = await tx.inventoryReservation.findMany({ where: { orderId: order.id } }); for (const reservation of reservations) await tx.inventory.update({ where: { variantId: reservation.variantId }, data: { quantity: { decrement: reservation.quantity }, reserved: { decrement: reservation.quantity } } }); const cart=await tx.cart.findUnique({where:{userId_status:{userId:order.userId,status:"ACTIVE"}}}); if(cart)await tx.cartItem.deleteMany({where:{cartId:cart.id}}); cartUserId=order.userId; }
    if (event.type === "payment_intent.payment_failed") { await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }); const order=await tx.order.findUniqueOrThrow({where:{id:payment.orderId}}); const reservations=await tx.inventoryReservation.findMany({where:{orderId:order.id,releasedAt:null}}); for(const reservation of reservations)await tx.inventory.update({where:{variantId:reservation.variantId},data:{reserved:{decrement:reservation.quantity},version:{increment:1}}}); await tx.inventoryReservation.updateMany({where:{orderId:order.id,releasedAt:null},data:{releasedAt:new Date()}}); await tx.order.update({where:{id:order.id},data:{status:"CANCELLED"}}); await tx.vendorOrder.updateMany({where:{orderId:order.id},data:{status:"CANCELLED"}}); await tx.orderStatusHistory.create({data:{orderId:order.id,fromStatus:order.status,toStatus:"CANCELLED",note:"Payment failed; inventory released"}}); }
  });
  if (cartUserId) await deleteCached(cartCacheKey(cartUserId));
  return { received: true };
}
