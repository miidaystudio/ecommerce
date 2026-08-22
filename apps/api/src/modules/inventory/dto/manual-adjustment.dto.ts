import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';

export class ManualAdjustmentDto {
  @IsInt()
  @NotEquals(0)
  @Type(() => Number)
  change!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
