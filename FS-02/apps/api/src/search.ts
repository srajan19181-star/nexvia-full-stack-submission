import { Client } from "@elastic/elasticsearch";
import { prisma } from "@aureva/database";
import { env } from "./config";

const indexName = "aureva-products";
const outboxLeaseMilliseconds = 5 * 60 * 1_000;
const elasticsearch = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 10_000,
  maxRetries: 1,
});

const indexMappings = {
  properties: {
    name: { type: "text" as const },
    slug: { type: "keyword" as const },
    description: { type: "text" as const },
    category: { type: "text" as const },
    categorySlug: { type: "keyword" as const },
    vendor: { type: "text" as const },
    vendorSlug: { type: "keyword" as const },
    price: { type: "integer" as const },
    currency: { type: "keyword" as const },
    rating: { type: "float" as const },
    available: { type: "boolean" as const },
    status: { type: "keyword" as const },
  },
};

async function ensureProductIndex() {
  if (await elasticsearch.indices.exists({ index: indexName })) return;

  try {
    await elasticsearch.indices.create({
      index: indexName,
      settings: { number_of_replicas: env.ELASTICSEARCH_REPLICAS },
      mappings: indexMappings,
    });
  } catch (error) {
    if (!(await elasticsearch.indices.exists({ index: indexName }))) throw error;
  }
}

async function productDocument(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      vendor: true,
      variants: { include: { inventory: true } },
    },
  });
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category.name,
    categorySlug: product.category.slug,
    vendor: product.vendor.storeName,
    vendorSlug: product.vendor.slug,
    price: product.basePrice,
    currency: product.currency,
    rating: Number(product.averageRating),
    available: product.variants.some(
      (variant) =>
        (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0) > 0,
    ),
    status: product.status,
  };
}

export async function reindexActiveProducts() {
  await ensureProductIndex();
  let cursor: string | undefined;
  let indexed = 0;

  while (true) {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!products.length) break;

    const documents = (
      await Promise.all(products.map((product) => productDocument(product.id)))
    ).filter((document): document is NonNullable<typeof document> => document !== null);

    if (documents.length) {
      await elasticsearch.bulk({
        refresh: false,
        operations: documents.flatMap((document) => [
          { index: { _index: indexName, _id: document.id } },
          document,
        ]),
      });
      indexed += documents.length;
    }

    cursor = products.at(-1)?.id;
  }

  await elasticsearch.indices.refresh({ index: indexName });
  return indexed;
}

export async function initializeSearchIndex() {
  await ensureProductIndex();
  const count = await elasticsearch.count({ index: indexName });
  if (count.count > 0) return { indexed: 0, bootstrapped: false };

  const indexed = await reindexActiveProducts();
  return { indexed, bootstrapped: true };
}

export async function processSearchOutbox() {
  const now = new Date();
  const jobs = await prisma.searchOutbox.findMany({
    where: {
      status: { in: ["PENDING", "FAILED", "PROCESSING"] },
      availableAt: { lte: now },
      attempts: { lt: 8 },
    },
    take: 25,
    orderBy: { createdAt: "asc" },
  });
  if (!jobs.length) return;

  await ensureProductIndex();
  for (const job of jobs) {
    const claimed = await prisma.searchOutbox.updateMany({
      where: {
        id: job.id,
        status: { in: ["PENDING", "FAILED", "PROCESSING"] },
        availableAt: { lte: now },
        attempts: { lt: 8 },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        availableAt: new Date(Date.now() + outboxLeaseMilliseconds),
      },
    });
    if (claimed.count !== 1) continue;

    try {
      if (job.operation === "DELETE") {
        await elasticsearch.delete(
          { index: indexName, id: job.aggregateId },
          { ignore: [404] },
        );
      } else {
        const document = await productDocument(job.aggregateId);
        if (document) {
          await elasticsearch.index({
            index: indexName,
            id: job.aggregateId,
            document,
            refresh: false,
          });
        }
      }
      await prisma.searchOutbox.update({
        where: { id: job.id },
        data: { status: "COMPLETED", processedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const attempts = job.attempts + 1;
      await prisma.searchOutbox.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message.slice(0, 1000) : "Indexing failed",
          availableAt: new Date(Date.now() + Math.min(300_000, 2 ** attempts * 1_000)),
        },
      });
    }
  }
}

async function searchProductsInPostgres(query: string) {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      images: { take: 1 },
      variants: {
        where: { isActive: true },
        include: { inventory: true },
        take: 1,
      },
      vendor: true,
      category: true,
    },
    take: 20,
  });
  return { source: "postgres-fallback", products };
}

export async function searchProducts(query: string) {
  try {
    const result = await elasticsearch.search({
      index: indexName,
      size: 20,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ["name^3", "description", "category^2", "vendor^2"],
                fuzziness: "AUTO",
              },
            },
          ],
          filter: [{ term: { status: "ACTIVE" } }],
        },
      },
    });
    const ids = result.hits.hits
      .map((hit) => hit._id)
      .filter((id): id is string => typeof id === "string");
    if (!ids.length) {
      const indexCount = await elasticsearch.count({ index: indexName });
      if (indexCount.count === 0) return searchProductsInPostgres(query);
    }
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      include: {
        images: { take: 1 },
        variants: {
          where: { isActive: true },
          include: { inventory: true },
          take: 1,
        },
        vendor: true,
        category: true,
      },
    });
    return {
      source: "elasticsearch",
      products: ids.flatMap((id) => products.filter((product) => product.id === id)),
    };
  } catch {
    return searchProductsInPostgres(query);
  }
}

export async function suggestProducts(query: string) {
  try {
    const [result, vendors, categories] = await Promise.all([
      elasticsearch.search<Record<string, unknown>>({
        index: indexName,
        size: 8,
        _source: ["name", "slug", "vendor", "category"],
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ["name^4", "vendor^2", "category^2"],
                  type: "bool_prefix",
                },
              },
            ],
            filter: [{ term: { status: "ACTIVE" } }],
          },
        },
      }),
      prisma.vendor.findMany({
        where: { status: "APPROVED", storeName: { contains: query, mode: "insensitive" } },
        select: { storeName: true, slug: true },
        take: 2,
      }),
      prisma.category.findMany({
        where: { isActive: true, name: { contains: query, mode: "insensitive" } },
        select: { name: true, slug: true },
        take: 2,
      }),
    ]);
    return {
      products: result.hits.hits.flatMap((hit) =>
        hit._source
          ? [
              {
                name: String(hit._source.name ?? ""),
                slug: String(hit._source.slug ?? ""),
                vendor: { storeName: String(hit._source.vendor ?? "") },
                category: { name: String(hit._source.category ?? "") },
              },
            ]
          : [],
      ),
      vendors,
      categories,
    };
  } catch {
    const [products, vendors, categories] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE", name: { startsWith: query, mode: "insensitive" } },
        select: {
          name: true,
          slug: true,
          vendor: { select: { storeName: true } },
          category: { select: { name: true } },
        },
        take: 6,
      }),
      prisma.vendor.findMany({
        where: { status: "APPROVED", storeName: { contains: query, mode: "insensitive" } },
        select: { storeName: true, slug: true },
        take: 2,
      }),
      prisma.category.findMany({
        where: { isActive: true, name: { contains: query, mode: "insensitive" } },
        select: { name: true, slug: true },
        take: 2,
      }),
    ]);
    return { products, vendors, categories };
  }
}
