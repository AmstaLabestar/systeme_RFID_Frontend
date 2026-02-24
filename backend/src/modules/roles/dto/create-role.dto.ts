import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class CreateRoleDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  tenantId!: string;

  @Transform(({ value }) => sanitizeString(String(value)).toLowerCase())
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((entry) => sanitizeString(String(entry))) : value,
  )
  permissions!: string[];
}
