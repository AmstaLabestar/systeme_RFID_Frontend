import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class VerifyTwoFactorCodeDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Two-factor code must be 6 digits.' })
  code!: string;
}
