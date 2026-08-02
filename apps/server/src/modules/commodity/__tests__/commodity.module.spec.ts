import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CommodityController } from '../commodity.controller';
import { CommodityModule } from '../commodity.module';
import { CommodityService } from '../commodity.service';

describe('CommodityModule', () => {
  it('registers its controller, provider, and exported service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CommodityModule)).toContain(CommodityController);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CommodityModule)).toContain(CommodityService);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, CommodityModule)).toContain(CommodityService);
  });
});
