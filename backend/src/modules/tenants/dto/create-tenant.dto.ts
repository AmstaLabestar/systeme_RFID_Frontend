import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { normalizeDomain, sanitizeString } from '../../../common/utils/security.util';

export class CreateTenantDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(({ value }) => normalizeDomain(String(value)))
  @IsString()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Invalid tenant domain format.' })
  domain!: string;
}
