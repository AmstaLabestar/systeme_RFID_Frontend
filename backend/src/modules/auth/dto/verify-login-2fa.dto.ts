import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class VerifyLoginTwoFactorDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Two-factor code must be 6 digits.' })
  code!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(20, 8000)
  twoFactorToken!: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? sanitizeString(String(value)) : value))
  @IsString()
  @Length(1, 255)
  redirectTo?: string;
}
