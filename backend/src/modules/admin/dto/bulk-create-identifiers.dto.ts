import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IdentifierType } from '@prisma/client';
import { sanitizeString } from '../../../common/utils/security.util';

export class BulkCreateIdentifiersDto {
  @IsOptional()
  @IsEnum(IdentifierType)
  type?: IdentifierType;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Type(() => String)
  physicalIdentifiers!: string[];

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,40}$/)
  warehouseCode?: string;

  normalize() {
    this.physicalIdentifiers = this.physicalIdentifiers.map((value) => sanitizeString(value));
    this.warehouseCode = this.warehouseCode ? sanitizeString(this.warehouseCode) : undefined;
    return this;
  }
}
