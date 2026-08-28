import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { SupermarketController } from '../supermarket.controller';
import { SupermarketModule } from '../supermarket.module';
import { SupermarketService } from '../supermarket.service';

describe('SupermarketModule', () => {
  it('registers its controller, provider, and exported service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SupermarketModule)).toContain(SupermarketController);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SupermarketModule)).toContain(SupermarketService);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, SupermarketModule)).toContain(SupermarketService);
  });
});
