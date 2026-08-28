import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CategoryModule } from './modules/category/category.module';
import { UnitModule } from './modules/unit/unit.module';
import { CommodityModule } from './modules/commodity/commodity.module';
import { PurchasePlaceModule } from './modules/purchase-place/purchase-place.module';
import { MarketModule } from './modules/market/market.module';
import { SupermarketModule } from './modules/supermarket/supermarket.module';
import { OrderModule } from './modules/order/order.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';

@Module({
  imports: [CommonModule, AuthModule, CategoryModule, UnitModule, CommodityModule, PurchasePlaceModule, MarketModule, SupermarketModule, OrderModule, AnalyticsModule],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
