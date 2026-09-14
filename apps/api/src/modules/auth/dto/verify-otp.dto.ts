import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Verification code must be a 4-digit number' })
  otp!: string;

  // The code alone only proves access to the inbox. Requiring the account
  // password too stops someone who re-registered the same email with their own
  // password from gaining the account when the real owner enters the code.
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  @MaxLength(72)
  password!: string;
}
