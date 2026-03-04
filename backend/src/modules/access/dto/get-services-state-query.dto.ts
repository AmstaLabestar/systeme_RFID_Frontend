import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
  }

  return true;
}

export class GetServicesStateQueryDto {
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  paginate = true;

  @IsOptional()
  @IsString()
  employeesCursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  employeesLimit = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  assignmentsCursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  assignmentsLimit = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  historyCursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  historyLimit = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  feedbackCursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  feedbackLimit = DEFAULT_PAGE_SIZE;
}
