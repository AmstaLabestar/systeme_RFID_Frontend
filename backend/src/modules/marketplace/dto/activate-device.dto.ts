import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class ActivateDeviceDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 120)
  name!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 255)
  location!: string;

  @Transform(({ value }) => sanitizeString(String(value)).toUpperCase().replaceAll('-', ':'))
  @IsString()
  @Matches(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/, {
    message: 'Identifiant systeme invalide. Utilisez une adresse MAC valide.',
  })
  systemIdentifier!: string;
}
