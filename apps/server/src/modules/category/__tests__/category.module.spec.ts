import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CategoryController } from '../category.controller';
import { CategoryModule } from '../category.module';
import { CategoryService } from '../category.service';

describe('CategoryModule', () => {
  it('registers its controller, provider, and exported service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CategoryModule)).toContain(CategoryController);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CategoryModule)).toContain(CategoryService);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, CategoryModule)).toContain(CategoryService);
  });
});
