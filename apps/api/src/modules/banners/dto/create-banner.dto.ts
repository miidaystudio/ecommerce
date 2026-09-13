import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IsSafeUrl } from '../../../common/decorators/is-safe-url.decorator';

export class CreateBannerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  // Both render into an href/src on the public storefront, so they are
  // constrained to safe schemes here — staff are not trusted to supply
  // arbitrary URLs (see prd.md: staff have limited privileges).
  @IsOptional()
  @IsSafeUrl()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsSafeUrl()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
