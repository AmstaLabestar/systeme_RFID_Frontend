import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class UpdateBusinessSystemPricingDto {
  @IsInt()
  @Min(0)
  deviceUnitPriceCents!: number;

  @IsInt()
  @Min(0)
  extensionUnitPriceCents!: number;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)).toUpperCase())
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;
}
