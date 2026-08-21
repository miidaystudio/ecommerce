import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService, UserProfile } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateProfile(user.id, dto);
  }
}
