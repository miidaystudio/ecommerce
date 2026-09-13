import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'Enter a valid phone number (7-15 digits, optional country code)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'Enter a valid phone number (7-15 digits, optional country code)',
  })
  phone?: string;
}
