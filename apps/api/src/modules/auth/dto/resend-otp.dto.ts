import { IsEmail } from 'class-validator';

export class ResendOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;
}
