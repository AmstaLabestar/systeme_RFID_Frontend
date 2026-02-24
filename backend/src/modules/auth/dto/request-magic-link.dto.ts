import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { normalizeEmail, sanitizeString } from '../../../common/utils/security.util';

export class RequestMagicLinkDto {
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email!: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 255)
  redirectTo?: string;
}
