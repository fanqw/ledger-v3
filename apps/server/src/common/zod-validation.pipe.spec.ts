import { UnprocessableEntityException } from '@nestjs/common';
import { z, ZodSchema } from 'zod';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(z.object({ count: z.coerce.number().int().positive() }));

    expect(pipe.transform({ count: '3' })).toEqual({ count: 3 });
  });

  it('throws a 422 response with the first validation issue', () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string().min(2, 'name is too short') }));

    expect(() => pipe.transform({ name: '' })).toThrow(UnprocessableEntityException);

    try {
      pipe.transform({ name: '' });
    } catch (error) {
      expect((error as UnprocessableEntityException).getStatus()).toBe(422);
      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'name is too short' },
      });
    }
  });

  it('uses the shared fallback message when no validation issue is present', () => {
    expect.assertions(1);
    const schema = {
      safeParse: jest.fn().mockReturnValue({ success: false, error: { issues: [] } }),
    } as unknown as ZodSchema;
    const pipe = new ZodValidationPipe(schema);

    try {
      pipe.transform('invalid');
    } catch (error) {
      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        },
      });
    }
  });

  it('propagates unexpected schema errors', () => {
    const schema = {
      safeParse: jest.fn(() => {
        throw new Error('schema unavailable');
      }),
    } as unknown as ZodSchema;
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform(undefined)).toThrow('schema unavailable');
  });

  it('passes undefined through when the schema accepts it', () => {
    const pipe = new ZodValidationPipe(z.unknown());

    expect(pipe.transform(undefined)).toBeUndefined();
  });
});
