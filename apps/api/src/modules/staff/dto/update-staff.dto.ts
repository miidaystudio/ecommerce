import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateStaffDto {
  // Same restriction as CreateStaffDto: a staff account cannot be turned into
  // a CUSTOMER through this endpoint.
  @IsOptional()
  @IsIn([Role.STAFF, Role.SUPER_ADMIN], { message: 'Role must be STAFF or SUPER_ADMIN' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
