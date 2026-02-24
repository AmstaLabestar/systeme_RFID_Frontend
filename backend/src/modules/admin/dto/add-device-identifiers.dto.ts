import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IdentifierType } from '@prisma/client';
import { sanitizeString } from '../../../common/utils/security.util';

export class AddDeviceIdentifiersDto {
  @IsOptional()
  @IsEnum(IdentifierType)
  type?: IdentifierType;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Type(() => String)
  physicalIdentifiers!: string[];

  normalize() {
    this.physicalIdentifiers = this.physicalIdentifiers.map((value) => sanitizeString(value));
    return this;
  }
}
