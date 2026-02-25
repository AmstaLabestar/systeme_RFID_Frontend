import { IsEnum, IsOptional } from 'class-validator';
import { OutboxEventType } from '@prisma/client';

export class TestWebhookDto {
  @IsOptional()
  @IsEnum(OutboxEventType)
  eventType?: OutboxEventType;
}
