import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  @Matches(/^\d{4}$/, { message: 'Verification code must be a 4-digit number' })
  otp!: string;
}
