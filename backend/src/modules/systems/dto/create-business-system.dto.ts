import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { HardwareSystemCode, IdentifierType } from '@prisma/client';
import { sanitizeString } from '../../../common/utils/security.util';

export class CreateBusinessSystemDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => sanitizeString(String(value)).toUpperCase())
  @IsEnum(HardwareSystemCode)
  code!: HardwareSystemCode;

  @IsBoolean()
  hasIdentifiers!: boolean;

  @IsInt()
  @Min(0)
  @Max(20)
  identifiersPerDevice!: number;

  @IsOptional()
  @IsEnum(IdentifierType)
  identifierType?: IdentifierType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
