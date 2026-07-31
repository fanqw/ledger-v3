import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: result.error.issues[0]?.message || ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
      });
    }
    return result.data;
  }
}
