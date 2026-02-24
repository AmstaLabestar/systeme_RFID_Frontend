import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { normalizeEmail, normalizePhone, sanitizeString } from '../../../common/utils/security.util';

export class LoginDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? sanitizeString(String(value)) : value))
  @IsString()
  @Length(3, 255)
  identifier?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? normalizeEmail(String(value)) : value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? normalizePhone(String(value)) : value))
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid phone number format.' })
  phoneNumber?: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(8, 120)
  password!: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 255)
  redirectTo?: string;
}
