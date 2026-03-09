import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { HardwareSystemCode } from '@prisma/client';
import { sanitizeString } from '../../../common/utils/security.util';

export class IngestDeviceEventSourceDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 80)
  deviceId!: string;

  @IsEnum(HardwareSystemCode)
  systemCode!: HardwareSystemCode;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(3, 32)
  deviceMac?: string;

  @IsOptional()
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 40)
  firmwareVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  sequence?: number;
}

export class IngestDeviceEventDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  @Length(1, 10)
  schemaVersion!: string;

  @Transform(({ value }) => sanitizeString(String(value)))
  @IsUUID()
  eventId!: string;

  @Transform(({ value }) => sanitizeString(String(value)).toLowerCase())
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)
  eventType!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsISO8601()
  sentAt?: string;

  @ValidateNested()
  @Type(() => IngestDeviceEventSourceDto)
  source!: IngestDeviceEventSourceDto;

  @IsObject()
  payload!: Record<string, unknown>;
}
