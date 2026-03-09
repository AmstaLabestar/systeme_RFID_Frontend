import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const DEFAULT_LOOKBACK_HOURS = 24;
const MAX_LOOKBACK_HOURS = 24 * 14;
const DEFAULT_LAST_EVENTS_LIMIT = 50;
const MAX_LAST_EVENTS_LIMIT = 200;

export class GetPresenceSnapshotQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK_HOURS)
  lookbackHours = DEFAULT_LOOKBACK_HOURS;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LAST_EVENTS_LIMIT)
  lastEventsLimit = DEFAULT_LAST_EVENTS_LIMIT;
}
