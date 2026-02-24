import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class GoogleLoginDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(20, 8000)
  idToken!: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 255)
  redirectTo?: string;
}
