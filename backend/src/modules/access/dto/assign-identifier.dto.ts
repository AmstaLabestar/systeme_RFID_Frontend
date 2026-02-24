import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

const MODULES = ['rfid-presence', 'rfid-porte', 'biometrie', 'feedback'] as const;

export class AssignIdentifierDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @IsIn(MODULES)
  module!: (typeof MODULES)[number];

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 120)
  deviceId!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 120)
  identifierId!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 80)
  lastName!: string;
}
