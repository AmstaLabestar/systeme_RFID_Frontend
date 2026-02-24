import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class ReassignIdentifierDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 120)
  deviceId!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 80)
  lastName!: string;
}
