import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { OutboxEventType } from '@prisma/client';
import { sanitizeString } from '../../../common/utils/security.util';

export class CreateWebhookEndpointDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUrl({
    require_tld: true,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(OutboxEventType, { each: true })
  @Type(() => String)
  events!: OutboxEventType[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  secret?: string;

  normalize() {
    this.name = sanitizeString(this.name);
    this.url = sanitizeString(this.url);
    this.events = this.events.map((eventType) => sanitizeString(String(eventType)) as OutboxEventType);
    this.secret = this.secret ? sanitizeString(this.secret) : undefined;
    return this;
  }
}
