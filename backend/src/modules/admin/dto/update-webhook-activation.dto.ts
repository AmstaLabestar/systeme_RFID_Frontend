import { IsBoolean } from 'class-validator';

export class UpdateWebhookActivationDto {
  @IsBoolean()
  isActive!: boolean;
}
