import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  line2?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
