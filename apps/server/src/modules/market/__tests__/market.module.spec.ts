import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { MarketController } from '../market.controller';
import { MarketModule } from '../market.module';
import { MarketService } from '../market.service';

describe('MarketModule', () => {
  it('registers its controller, provider, and exported service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, MarketModule)).toContain(MarketController);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MarketModule)).toContain(MarketService);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, MarketModule)).toContain(MarketService);
  });
});
