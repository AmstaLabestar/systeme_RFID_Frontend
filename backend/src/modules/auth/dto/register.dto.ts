import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import {
  normalizeEmail,
  normalizePhone,
  sanitizeString,
} from '../../../common/utils/security.util';

export class RegisterDto {
  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(2, 120)
  company?: string;

  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? normalizePhone(String(value)) : value))
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid phone number format.' })
  phoneNumber?: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(2, 120)
  tenantName?: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 255)
  redirectTo?: string;
}
