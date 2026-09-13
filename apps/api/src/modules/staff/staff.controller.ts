import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService, StaffView } from './staff.service';

// SUPER_ADMIN only, for the whole controller. prd.md is explicit that staff
// have "no access to sensitive settings (payment keys, staff management)" —
// were STAFF allowed here, any staff member could promote themselves.
@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(): Promise<StaffView[]> {
    return this.staffService.list();
  }

  @Post()
  create(@Body() dto: CreateStaffDto): Promise<StaffView> {
    return this.staffService.create(dto);
  }

  // The acting user comes from the verified JWT, never from the request body —
  // otherwise the self-lockout guards could be bypassed by claiming to be
  // somebody else.
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffView> {
    return this.staffService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ success: true }> {
    return this.staffService.remove(user.id, id);
  }
}
