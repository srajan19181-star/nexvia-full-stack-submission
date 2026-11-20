ALTER TABLE "Product"
ADD COLUMN "basePrice" INTEGER,
ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'INR';

UPDATE "Product" AS product
SET "basePrice" = variant."minimumPrice"
FROM (
  SELECT "productId", MIN("price") AS "minimumPrice"
  FROM "ProductVariant"
  WHERE "isActive" = true
  GROUP BY "productId"
) AS variant
WHERE product."id" = variant."productId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE "basePrice" IS NULL) THEN
    RAISE EXCEPTION 'Cannot set Product.basePrice: product without an active variant exists';
  END IF;
END $$;

ALTER TABLE "Product" ALTER COLUMN "basePrice" SET NOT NULL;
