import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class ConfigureDeviceDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

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
