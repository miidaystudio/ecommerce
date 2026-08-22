import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecentlyViewedQueryDto {
  // Comma-separated product ids, most-recently-viewed first. Capped in length
  // here and again by count in the service.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ids?: string;
}
