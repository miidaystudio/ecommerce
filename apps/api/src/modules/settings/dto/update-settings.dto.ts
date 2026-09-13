import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Every field optional: the settings screen saves a partial patch, and the
// service merges against current values so an unsent field is left alone
// rather than reset to a schema default.
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  storeName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine?: string;

  // Restricted to currencies Razorpay is actually configured for here; a free
  // string would let an admin set a currency the gateway then rejects at pay time.
  @IsOptional()
  @IsIn(['INR'])
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  @Type(() => Number)
  freeShippingThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  @Type(() => Number)
  flatShippingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  @Type(() => Number)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  ordersEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  maintenanceNotice?: string;
}
