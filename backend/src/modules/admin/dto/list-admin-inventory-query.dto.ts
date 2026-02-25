import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeviceStatus, HardwareSystemCode } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { sanitizeString } from '../../../common/utils/security.util';

export class ListAdminInventoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  systemId?: string;

  @IsOptional()
  @IsEnum(HardwareSystemCode)
  systemCode?: HardwareSystemCode;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  warehouseCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  search?: string;
}
