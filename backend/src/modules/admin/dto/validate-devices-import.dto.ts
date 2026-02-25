import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

class DeviceImportRowDto {
  @IsString()
  @MaxLength(120)
  macAddress!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Type(() => String)
  identifiers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  warehouseCode?: string;
}

export class ValidateDevicesImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceImportRowDto)
  devices!: DeviceImportRowDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  warehouseCode?: string;

  normalize() {
    this.devices = this.devices.map((row) => ({
      macAddress: sanitizeString(row.macAddress),
      identifiers: row.identifiers?.map((identifier) => sanitizeString(identifier)),
      warehouseCode: row.warehouseCode ? sanitizeString(row.warehouseCode) : undefined,
    }));
    this.warehouseCode = this.warehouseCode ? sanitizeString(this.warehouseCode) : undefined;
    return this;
  }
}
