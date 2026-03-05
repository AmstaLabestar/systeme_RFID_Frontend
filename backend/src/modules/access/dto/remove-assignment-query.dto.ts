import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class RemoveAssignmentQueryDto {
  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(3, 240)
  reason?: string;
}
