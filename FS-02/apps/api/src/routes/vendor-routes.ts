import { randomUUID } from "node:crypto";
import { Router } from "express";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@aureva/database";
import { canTransitionOrder, productInputSchema, vendorApplicationSchema, type OrderStatus } from "@aureva/shared";
import { authenticate, requireRole } from "../auth";
import { env, s3InternalEndpoint, s3PublicEndpoint } from "../config";
import { asyncRoute, AppError, ok, validate } from "../http";
import { z } from "zod";

export const vendorRoutes = Router();
vendorRoutes.use(authenticate);

vendorRoutes.post("/apply", asyncRoute(async (request, response) => {
  const input = validate(vendorApplicationSchema, request.body);
  if (await prisma.vendor.findUnique({ where: { ownerId: request.user!.id } })) throw new AppError(409, "VENDOR_EXISTS", "A vendor profile already exists");
  const vendor = await prisma.$transaction(async (transaction) => {
    const created = await transaction.vendor.create({ data: { ownerId: request.user!.id, ...input, application: { create: {} }, verification: { create: {} } }, include: { application: true, verification: true } });
    await transaction.user.update({ where: { id: request.user!.id }, data: { roles: { push: "VENDOR" } } });
    await transaction.auditLog.create({ data: { actorId: request.user!.id, action: "VENDOR_APPLICATION_SUBMITTED", entityType: "Vendor", entityId: created.id } });
    return created;
  });
  return ok(response, vendor, 201);
}));

vendorRoutes.use(requireRole("VENDOR", "ADMIN"));

async function ownVendor(userId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: userId }, include: { application: true, verification: true, payoutAccount: true } });
  if (!vendor) throw new AppError(403, "VENDOR_REQUIRED", "Vendor profile required");
  return vendor;
}

async function verifyImages(vendorId: string, images: string[]) {
  if (env.NODE_ENV !== "production") return;
  const uniqueImages = [...new Set(images)];
  const verified = await prisma.mediaUpload.count({ where: { vendorId, status: "VERIFIED", url: { in: uniqueImages } } });
  if (verified !== uniqueImages.length) throw new AppError(422, "IMAGE_NOT_VERIFIED", "Every product image must be uploaded and verified through AUREVA storage");
}

vendorRoutes.get("/dashboard", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const [products, orders, revenue] = await prisma.$transaction([
    prisma.product.count({ where: { vendorId: vendor.id } }),
    prisma.vendorOrder.count({ where: { vendorId: vendor.id } }),
    prisma.vendorOrder.aggregate({ where: { vendorId: vendor.id, status: { in: ["PLACED", "PACKED", "SHIPPED", "DELIVERED"] } }, _sum: { vendorNet: true } }),
  ]);
  return ok(response, { vendor, metrics: { products, orders, revenue: revenue._sum.vendorNet ?? 0 } });
}));

vendorRoutes.get("/products", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  return ok(response, await prisma.product.findMany({ where: { vendorId: vendor.id }, include: { images: true, variants: { include: { inventory: true }, orderBy: { price: "asc" } }, category: true, brand: true }, orderBy: { createdAt: "desc" } }));
}));

vendorRoutes.post("/products", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  if (vendor.status !== "APPROVED") throw new AppError(403, "VENDOR_NOT_APPROVED", "Admin approval is required before listing products");
  const input = validate(productInputSchema, request.body);
  await verifyImages(vendor.id, input.images);
  const variants = input.variants ?? [{ name: "Default", sku: input.sku, price: input.price, compareAtPrice: input.compareAtPrice ?? null, currency: input.currency, stock: input.stock, attributes: {} }];
  if (new Set(variants.map((variant) => variant.sku)).size !== variants.length) throw new AppError(422, "DUPLICATE_SKU", "Variant SKUs must be unique");
  if (await prisma.productVariant.count({ where: { sku: { in: variants.map((variant) => variant.sku) } } })) throw new AppError(409, "SKU_IN_USE", "A variant SKU is already in use");
  const product = await prisma.$transaction(async (transaction) => {
    const created = await transaction.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: input.categoryId,
        brandId: input.brandId ?? null,
        name: input.name,
        slug: input.slug,
        description: input.description,
        basePrice: Math.min(...variants.map((variant) => variant.price)),
        currency: input.currency,
        specifications: input.specifications,
        status: "PENDING_REVIEW",
        variants: { create: variants.map((variant) => ({ name: variant.name, sku: variant.sku, price: variant.price, compareAtPrice: variant.compareAtPrice ?? null, currency: variant.currency, attributes: variant.attributes, inventory: { create: { quantity: variant.stock } } })) },
        images: { create: input.images.map((url, index) => ({ url, altText: input.name, sortOrder: index })) },
      },
      include: { images: true, variants: { include: { inventory: true } } },
    });
    await transaction.searchOutbox.create({ data: { aggregateType: "Product", aggregateId: created.id, operation: "UPSERT", payload: { id: created.id } } });
    await transaction.auditLog.create({ data: { actorId: request.user!.id, action: "PRODUCT_SUBMITTED", entityType: "Product", entityId: created.id } });
    return created;
  });
  return ok(response, product, 201);
}));

vendorRoutes.put("/products/:id", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const input = validate(productInputSchema.partial(), request.body);
  if (input.images) await verifyImages(vendor.id, input.images);
  const existing = await prisma.product.findFirst({ where: { id: request.params.id as string, vendorId: vendor.id }, include: { variants: true } });
  if (!existing) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (input.variants && new Set(input.variants.map((variant) => variant.sku)).size !== input.variants.length) throw new AppError(422, "DUPLICATE_SKU", "Variant SKUs must be unique");
  if (input.variants && await prisma.productVariant.count({ where: { sku: { in: input.variants.map((variant) => variant.sku) }, productId: { not: existing.id } } })) throw new AppError(409, "SKU_IN_USE", "A variant SKU is already used by another product");

  const updated = await prisma.$transaction(async (transaction) => {
    const product = await transaction.product.update({
      where: { id: existing.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
        ...(input.variants?.length ? { basePrice: Math.min(...input.variants.map((variant) => variant.price)) } : input.price !== undefined ? { basePrice: input.price } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.specifications ? { specifications: input.specifications } : {}),
        status: "PENDING_REVIEW",
      },
    });

    if (input.variants) {
      const retainedIds: string[] = [];
      for (const variantInput of input.variants) {
        const current = existing.variants.find((variant) => variant.sku === variantInput.sku);
        const variant = current
          ? await transaction.productVariant.update({ where: { id: current.id }, data: { name: variantInput.name, price: variantInput.price, compareAtPrice: variantInput.compareAtPrice ?? null, currency: variantInput.currency, attributes: variantInput.attributes, isActive: true } })
          : await transaction.productVariant.create({ data: { productId: product.id, name: variantInput.name, sku: variantInput.sku, price: variantInput.price, compareAtPrice: variantInput.compareAtPrice ?? null, currency: variantInput.currency, attributes: variantInput.attributes, isActive: true } });
        retainedIds.push(variant.id);
        await transaction.inventory.upsert({ where: { variantId: variant.id }, create: { variantId: variant.id, quantity: variantInput.stock }, update: { quantity: variantInput.stock } });
      }
      await transaction.productVariant.updateMany({ where: { productId: product.id, id: { notIn: retainedIds } }, data: { isActive: false } });
    } else {
      const variant = existing.variants[0];
      if (variant) {
        await transaction.productVariant.update({ where: { id: variant.id }, data: { ...(input.sku ? { sku: input.sku } : {}), ...(input.price !== undefined ? { price: input.price } : {}), ...(input.compareAtPrice !== undefined ? { compareAtPrice: input.compareAtPrice } : {}), ...(input.currency ? { currency: input.currency } : {}) } });
        if (input.stock !== undefined) await transaction.inventory.upsert({ where: { variantId: variant.id }, create: { variantId: variant.id, quantity: input.stock }, update: { quantity: input.stock } });
      }
    }

    if (input.images) {
      await transaction.productImage.deleteMany({ where: { productId: product.id } });
      await transaction.productImage.createMany({ data: input.images.map((url, index) => ({ productId: product.id, url, altText: input.name ?? product.name, sortOrder: index })) });
    }
    await transaction.searchOutbox.create({ data: { aggregateType: "Product", aggregateId: product.id, operation: "UPSERT", payload: { id: product.id } } });
    await transaction.auditLog.create({ data: { actorId: request.user!.id, action: "PRODUCT_RESUBMITTED", entityType: "Product", entityId: product.id } });
    return transaction.product.findUniqueOrThrow({ where: { id: product.id }, include: { images: true, variants: { include: { inventory: true } } } });
  });
  return ok(response, updated);
}));

vendorRoutes.delete("/products/:id", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const product = await prisma.product.findFirst({ where: { id: request.params.id as string, vendorId: vendor.id } });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  const archived = await prisma.$transaction(async (transaction) => {
    const value = await transaction.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });
    await transaction.productVariant.updateMany({ where: { productId: product.id }, data: { isActive: false } });
    await transaction.searchOutbox.create({ data: { aggregateType: "Product", aggregateId: product.id, operation: "DELETE", payload: { id: product.id } } });
    await transaction.auditLog.create({ data: { actorId: request.user!.id, action: "PRODUCT_ARCHIVED", entityType: "Product", entityId: product.id } });
    return value;
  });
  return ok(response, archived);
}));

vendorRoutes.get("/orders", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  return ok(response, await prisma.vendorOrder.findMany({ where: { vendorId: vendor.id }, include: { order: { include: { user: { select: { name: true, email: true } }, address: true } }, items: true, shipments: { include: { events: { orderBy: { occurredAt: "asc" } } } } }, orderBy: { createdAt: "desc" } }));
}));

vendorRoutes.post("/orders/:id/status", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const { status, trackingNumber, carrier } = validate(z.object({ status: z.enum(["PACKED", "SHIPPED", "DELIVERED"]), trackingNumber: z.string().trim().min(3).max(120).optional(), carrier: z.string().trim().min(2).max(100).optional() }), request.body);
  const vendorOrder = await prisma.vendorOrder.findFirst({ where: { id: request.params.id as string, vendorId: vendor.id } });
  if (!vendorOrder) throw new AppError(404, "ORDER_NOT_FOUND", "Vendor order not found");
  if (!canTransitionOrder(vendorOrder.status as OrderStatus, status)) throw new AppError(409, "INVALID_TRANSITION", `Cannot move ${vendorOrder.status} to ${status}`);
  if (status === "SHIPPED" && (!trackingNumber || !carrier)) throw new AppError(422, "TRACKING_REQUIRED", "Carrier and tracking number are required");
  const updated = await prisma.$transaction(async (transaction) => {
    const value = await transaction.vendorOrder.update({ where: { id: vendorOrder.id }, data: { status } });
    if (status === "SHIPPED") await transaction.shipment.create({ data: { vendorOrderId: vendorOrder.id, trackingNumber: trackingNumber!, carrier: carrier!, shippedAt: new Date(), status: "SHIPPED" } });
    const siblings = await transaction.vendorOrder.findMany({ where: { orderId: vendorOrder.orderId, id: { not: vendorOrder.id } } });
    if (siblings.every((item) => item.status === status)) {
      const order = await transaction.order.findUniqueOrThrow({ where: { id: vendorOrder.orderId } });
      await transaction.order.update({ where: { id: order.id }, data: { status } });
      await transaction.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: status, actorId: request.user!.id } });
      await transaction.notification.create({ data: { userId: order.userId, type: `ORDER_${status}`, title: `Order ${status.toLowerCase()}`, message: `All sellers moved order ${order.orderNumber} to ${status.toLowerCase()}.`, data: { orderId: order.id } } });
    }
    await transaction.auditLog.create({ data: { actorId: request.user!.id, action: `VENDOR_ORDER_${status}`, entityType: "VendorOrder", entityId: vendorOrder.id } });
    return value;
  });
  return ok(response, updated);
}));

const s3Credentials = { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY };
const s3Public = new S3Client({ region: env.S3_REGION, endpoint: s3PublicEndpoint, forcePathStyle: true, credentials: s3Credentials });
const s3Internal = new S3Client({ region: env.S3_REGION, endpoint: s3InternalEndpoint, forcePathStyle: true, credentials: s3Credentials });
const uploadSchema = z.object({ fileName: z.string().min(1).max(120), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(8_000_000) });

vendorRoutes.post("/uploads/presign", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const input = validate(uploadSchema, request.body);
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[input.contentType];
  const key = `products/${vendor.id}/${randomUUID()}.${extension}`;
  const publicUrl = `${s3PublicEndpoint}/${env.S3_BUCKET}/${key}`;
  const upload = await prisma.mediaUpload.create({ data: { vendorId: vendor.id, userId: request.user!.id, key, url: publicUrl, contentType: input.contentType, size: input.size } });
  const command = new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: input.contentType, ContentLength: input.size });
  return ok(response, { id: upload.id, key, uploadUrl: await getSignedUrl(s3Public, command, { expiresIn: 300 }), publicUrl });
}));

vendorRoutes.post("/uploads/:id/complete", asyncRoute(async (request, response) => {
  const vendor = await ownVendor(request.user!.id);
  const upload = await prisma.mediaUpload.findFirst({ where: { id: request.params.id as string, vendorId: vendor.id, userId: request.user!.id } });
  if (!upload) throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
  try {
    const object = await s3Internal.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: upload.key }));
    if (object.ContentLength !== upload.size || object.ContentType !== upload.contentType) {
      await prisma.mediaUpload.update({ where: { id: upload.id }, data: { status: "REJECTED" } });
      throw new AppError(422, "UPLOAD_MISMATCH", "Uploaded object does not match the signed request");
    }
    return ok(response, await prisma.mediaUpload.update({ where: { id: upload.id }, data: { status: "VERIFIED", verifiedAt: new Date() } }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(409, "UPLOAD_INCOMPLETE", "The uploaded object could not be verified");
  }
}));
