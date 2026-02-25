import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { sanitizeString } from '../../../common/utils/security.util';

export class ListAdminAuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  action?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  targetType?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  actorId?: string;
}
