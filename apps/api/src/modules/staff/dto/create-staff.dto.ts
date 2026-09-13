import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateStaffDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  // Mirrors RegisterDto's bounds; 72 is bcrypt's own input limit, above which
  // extra characters are silently ignored.
  @IsString()
  @MinLength(12, { message: 'Staff passwords must be at least 12 characters' })
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

  // @IsIn rather than @IsEnum(Role): CUSTOMER is a valid Role but must not be
  // creatable here, so the enum's full set is deliberately not accepted.
  @IsIn([Role.STAFF, Role.SUPER_ADMIN], { message: 'Role must be STAFF or SUPER_ADMIN' })
  role!: Role;
}
