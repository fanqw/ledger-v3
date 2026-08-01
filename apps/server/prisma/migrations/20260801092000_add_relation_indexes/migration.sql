-- CreateIndex
CREATE INDEX "Commodity_categoryId_idx" ON "Commodity"("categoryId");

-- CreateIndex
CREATE INDEX "Commodity_unitId_idx" ON "Commodity"("unitId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_commodityId_idx" ON "OrderItem"("commodityId");
