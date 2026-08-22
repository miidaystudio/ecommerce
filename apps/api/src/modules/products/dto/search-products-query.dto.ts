import { IsString, MinLength } from 'class-validator';

export class SearchProductsQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;
}
