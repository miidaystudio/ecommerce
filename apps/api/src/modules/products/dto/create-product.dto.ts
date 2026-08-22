import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { ProductVariantDto } from './product-variant.dto';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @ArrayMinSize(1)
  variants!: ProductVariantDto[];
}
