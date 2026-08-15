const passportCanActivate = jest.fn();

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class {
    canActivate(context: unknown) {
      return passportCanActivate(context);
    }
  },
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, JwtAuthGuard, Public } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const handler = jest.fn();
  class Controller {}
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
  } as unknown as ExecutionContext;
  const getAllAndOverride = jest.fn();
  const guard = new JwtAuthGuard({ getAllAndOverride } as unknown as Reflector);

  beforeEach(() => jest.clearAllMocks());

  it('creates the public-route metadata decorator', () => {
    expect(Public()).toEqual(expect.any(Function));
  });

  it('allows public routes without invoking Passport', () => {
    getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, Controller]);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('delegates protected routes to the JWT Passport guard', () => {
    getAllAndOverride.mockReturnValue(false);
    passportCanActivate.mockReturnValue(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(passportCanActivate).toHaveBeenCalledWith(context);
  });

  it('propagates authentication failures from Passport', () => {
    getAllAndOverride.mockReturnValue(undefined);
    passportCanActivate.mockImplementation(() => { throw new Error('unauthorized'); });
    expect(() => guard.canActivate(context)).toThrow('unauthorized');
  });
});
