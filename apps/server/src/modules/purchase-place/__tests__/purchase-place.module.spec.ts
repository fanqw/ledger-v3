import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { PurchasePlaceController } from '../purchase-place.controller';
import { PurchasePlaceModule } from '../purchase-place.module';
import { PurchasePlaceService } from '../purchase-place.service';

describe('PurchasePlaceModule', () => {
  it('registers its controller, provider, and exported service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PurchasePlaceModule)).toContain(PurchasePlaceController);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PurchasePlaceModule)).toContain(PurchasePlaceService);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, PurchasePlaceModule)).toContain(PurchasePlaceService);
  });
});
