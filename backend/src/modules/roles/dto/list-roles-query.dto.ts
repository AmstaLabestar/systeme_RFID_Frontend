import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { sanitizeString } from '../../../common/utils/security.util';

export class ListRolesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizeString(String(value)))
  tenantId?: string;
}
