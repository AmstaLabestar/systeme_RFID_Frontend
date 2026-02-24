import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class RefreshTokenDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(20, 8000)
  refreshToken!: string;
}
