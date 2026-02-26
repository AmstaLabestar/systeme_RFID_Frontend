import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

class DeviceStockItemDto {
  @IsString()
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/)
  macAddress!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^(([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}|[A-Za-z0-9][A-Za-z0-9:_-]{1,119})$/, {
    each: true,
  })
  @MaxLength(120, { each: true })
  @Type(() => String)
  identifiers?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,40}$/)
  warehouseCode?: string;
}

export class BulkCreateDevicesDto {
  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeviceStockItemDto)
  devices!: DeviceStockItemDto[];

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,40}$/)
  warehouseCode?: string;

  normalize() {
    this.devices = this.devices.map((device) => ({
      macAddress: sanitizeString(device.macAddress),
      identifiers: device.identifiers?.map((identifier) => sanitizeString(identifier)),
      warehouseCode: device.warehouseCode
        ? sanitizeString(device.warehouseCode)
        : undefined,
    }));
    this.warehouseCode = this.warehouseCode ? sanitizeString(this.warehouseCode) : undefined;

    return this;
  }
}
