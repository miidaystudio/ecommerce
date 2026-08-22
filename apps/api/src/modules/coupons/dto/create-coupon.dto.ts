import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  // Uppercase alphanumeric (plus - and _) so codes are unambiguous to type and
  // can't smuggle whitespace/control characters past a lookup.
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,32}$/, {
    message: 'Code must be 3-32 characters, uppercase letters, digits, hyphen or underscore only',
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  // Must be > 0 — a zero or negative discount is never a valid coupon, and a
  // negative one would inflate the order total.
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  discountValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  maxDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  perUserLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
