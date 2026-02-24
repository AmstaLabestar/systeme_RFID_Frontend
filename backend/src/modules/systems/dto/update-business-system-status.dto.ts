import { IsBoolean } from 'class-validator';

export class UpdateBusinessSystemStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
