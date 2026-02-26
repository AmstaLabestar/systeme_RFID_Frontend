import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class ConfigureDeviceDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : sanitizeString(String(value)),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  location!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @MinLength(12)
  @MaxLength(17)
  systemIdentifier!: string;
}
