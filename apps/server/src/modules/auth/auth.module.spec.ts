import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { AuthController } from './auth.controller';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('AuthModule', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule);

  it('registers Passport and JwtModule', () => {
    expect(imports).toContain(PassportModule);
    expect(imports).toContainEqual(expect.objectContaining({ module: JwtModule }));
  });

  it('registers the authentication controller and providers', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).toEqual([AuthController]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule)).toEqual([
      AuthService,
      JwtStrategy,
      PrismaService,
      RedisService,
    ]);
  });

  it('exports AuthService', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule)).toEqual([AuthService]);
  });
});
