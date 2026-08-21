import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppModule } from './app.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { CategoryModule } from './modules/category/category.module';
import { CommodityModule } from './modules/commodity/commodity.module';
import { PurchasePlaceModule } from './modules/purchase-place/purchase-place.module';
import { OrderModule } from './modules/order/order.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { UnitModule } from './modules/unit/unit.module';

describe('AppModule', () => {
  it('registers all application modules and the health controller', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toEqual([
      CommonModule,
      AuthModule,
      CategoryModule,
      UnitModule,
      CommodityModule,
      PurchasePlaceModule,
      OrderModule,
      AnalyticsModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule)).toEqual([
      AppController,
    ]);
  });

  it('registers JwtAuthGuard as the global application guard', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule)).toEqual([
      { provide: APP_GUARD, useClass: JwtAuthGuard },
    ]);
  });
});
