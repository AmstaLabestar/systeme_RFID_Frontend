import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StockMovementAction, StockResourceType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { sanitizeString } from '../../../common/utils/security.util';

export class ListStockMovementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  systemId?: string;

  @IsOptional()
  @IsEnum(StockResourceType)
  resourceType?: StockResourceType;

  @IsOptional()
  @IsEnum(StockMovementAction)
  action?: StockMovementAction;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  warehouseCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  search?: string;
}
