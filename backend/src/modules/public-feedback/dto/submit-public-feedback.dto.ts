import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

const FEEDBACK_VALUES = ['NEGATIVE', 'NEUTRAL', 'POSITIVE'] as const;

export class SubmitPublicFeedbackDto {
  @Transform(({ value }) => sanitizeString(String(value)).toUpperCase())
  @IsString()
  @IsIn(FEEDBACK_VALUES)
  value!: (typeof FEEDBACK_VALUES)[number];

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? value : sanitizeString(String(value)),
  )
  @IsString()
  @MaxLength(280)
  comment?: string;
}
