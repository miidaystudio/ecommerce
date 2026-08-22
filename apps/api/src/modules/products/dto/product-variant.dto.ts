import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  sku!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  compareAtPrice?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
