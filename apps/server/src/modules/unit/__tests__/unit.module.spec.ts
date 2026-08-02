import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { UnitController } from '../unit.controller';
import { UnitModule } from '../unit.module';
import { UnitService } from '../unit.service';

describe('UnitModule', () => {
  it('registers its controller, provider, and exported service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UnitModule)).toContain(UnitController);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UnitModule)).toContain(UnitService);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, UnitModule)).toContain(UnitService);
  });
});
