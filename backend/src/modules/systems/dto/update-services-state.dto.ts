import { IsArray } from 'class-validator';

export class UpdateServicesStateDto {
  @IsArray()
  employees!: unknown[];

  @IsArray()
  assignments!: unknown[];

  @IsArray()
  history!: unknown[];

  @IsArray()
  feedbackRecords!: unknown[];
}
