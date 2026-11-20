import { prisma } from "@aureva/database";

export async function releaseExpiredReservations() {
  const orders = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", reservations: { some: { expiresAt: { lte: new Date() }, releasedAt: null } } },
    include: { reservations: { where: { releasedAt: null } } },
    take: 100,
  });
  for (const order of orders) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.status !== "PENDING_PAYMENT") return;
      for (const reservation of order.reservations) await tx.inventory.update({ where: { variantId: reservation.variantId }, data: { reserved: { decrement: reservation.quantity }, version: { increment: 1 } } });
      await tx.inventoryReservation.updateMany({ where: { orderId: order.id, releasedAt: null }, data: { releasedAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await tx.vendorOrder.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
      await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["REQUIRES_ACTION", "PROCESSING"] } }, data: { status: "FAILED" } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: "PENDING_PAYMENT", toStatus: "CANCELLED", note: "Payment window expired; inventory released" } });
    });
  }
  return orders.length;
}
