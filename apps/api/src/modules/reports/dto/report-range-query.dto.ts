import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type ReportGroupBy = 'day' | 'week' | 'month';

export class ReportRangeQueryDto {
  // Omitted defaults to the last 30 days; the service caps the total span so a
  // single request can't ask for an unbounded scan.
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: ReportGroupBy;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;
}
