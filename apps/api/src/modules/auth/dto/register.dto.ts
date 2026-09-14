import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

// 7–15 digits (the E.164 maximum) with optional leading + and common separators,
// so numbers from any country are accepted in the way people usually type them.
const PHONE_PATTERN = /^(?=(?:\D*\d){7,15}\D*$)\+?[0-9\s\-()]{7,20}$/;
const PHONE_MESSAGE = 'Enter a valid phone number (7-15 digits, optional country code)';

export class RegisterDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  // Required unless the older `phone` field is sent instead.
  @ValidateIf((dto: RegisterDto) => dto.phone === undefined)
  @IsString({ message: 'Phone number is required' })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string;
}
