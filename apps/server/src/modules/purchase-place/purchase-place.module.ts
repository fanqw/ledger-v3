import { Module } from '@nestjs/common';
import { PurchasePlaceController } from './purchase-place.controller';
import { PurchasePlaceService } from './purchase-place.service';

@Module({
  controllers: [PurchasePlaceController],
  providers: [PurchasePlaceService],
  exports: [PurchasePlaceService],
})
export class PurchasePlaceModule {}
