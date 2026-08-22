import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsIn([7, 30, 90])
  @Type(() => Number)
  days?: number = 30;
}
