import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  Matches,
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
  @Matches(/^(([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}|[A-Za-z0-9][A-Za-z0-9:_-]{1,119})$/, {
    each: true,
  })
  @MaxLength(120, { each: true })
  @Type(() => String)
  physicalIdentifiers!: string[];

  normalize() {
    this.physicalIdentifiers = this.physicalIdentifiers.map((value) => sanitizeString(value));
    return this;
  }
}
