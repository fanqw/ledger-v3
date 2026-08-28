/*
  Warnings:

  - You are about to drop the column `purchasePlaceId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `marketName` on the `PurchasePlace` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_purchasePlaceId_fkey";

-- DropIndex
DROP INDEX "Order_purchasePlaceId_idx";

-- DropIndex
DROP INDEX "PurchasePlace_place_marketName_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "purchasePlaceId",
ADD COLUMN     "marketId" TEXT;

-- AlterTable
ALTER TABLE "PurchasePlace" DROP COLUMN "marketName";

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supermarket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supermarket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Market_name_idx" ON "Market"("name");

-- CreateIndex
CREATE INDEX "Market_cityId_idx" ON "Market"("cityId");

-- CreateIndex
CREATE INDEX "Supermarket_name_idx" ON "Supermarket"("name");

-- CreateIndex
CREATE INDEX "Order_marketId_idx" ON "Order"("marketId");

-- CreateIndex
CREATE INDEX "PurchasePlace_place_idx" ON "PurchasePlace"("place");

-- 部分唯一索引：软删除后允许重名（项目惯例，参考 soft_delete_unique_fix）
CREATE UNIQUE INDEX "PurchasePlace_place_key" ON "PurchasePlace"("place") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Supermarket_name_key" ON "Supermarket"("name") WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "PurchasePlace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
