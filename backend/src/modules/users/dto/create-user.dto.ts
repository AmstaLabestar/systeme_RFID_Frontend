import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  normalizeEmail,
  normalizePhone,
  sanitizeString,
} from '../../../common/utils/security.util';
import { IsModernPassword } from '../../../common/validators/password-policy.validator';

export class CreateUserDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email!: string;

  @Transform(({ value }) => (value !== undefined ? normalizePhone(String(value)) : value))
  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid phone format.' })
  phoneNumber?: string;

  @Transform(({ value }) => (value !== undefined ? sanitizeString(String(value)) : value))
  @IsOptional()
  @IsString()
  @IsModernPassword()
  password?: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  tenantId!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  roleId!: string;
}
