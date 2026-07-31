-- Drop old unique indexes that conflict with soft-delete
DROP INDEX IF EXISTS "Category_name_key";
DROP INDEX IF EXISTS "Unit_name_key";
DROP INDEX IF EXISTS "Commodity_name_unitId_key";
DROP INDEX IF EXISTS "PurchasePlace_place_marketName_key";
DROP INDEX IF EXISTS "Order_name_deletedAt_key";

-- Create performance indexes for search/filtering
CREATE INDEX "Category_name_idx" ON "Category"("name");
CREATE INDEX "Unit_name_idx" ON "Unit"("name");
CREATE INDEX "Commodity_name_unitId_idx" ON "Commodity"("name", "unitId");
CREATE INDEX "PurchasePlace_place_marketName_idx" ON "PurchasePlace"("place", "marketName");
CREATE INDEX "Order_name_idx" ON "Order"("name");

-- Create partial unique indexes that respect soft-delete (only on non-deleted rows)
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Commodity_name_unitId_key" ON "Commodity"("name", "unitId") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "PurchasePlace_place_marketName_key" ON "PurchasePlace"("place", "marketName") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Order_name_key" ON "Order"("name") WHERE "deletedAt" IS NULL;
