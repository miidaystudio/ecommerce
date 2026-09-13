import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PublicStoreSettings, SettingsService, StoreSettingsView } from './settings.service';

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Storefront-visible subset: contact details, shipping thresholds, notices. */
  @Get('settings')
  getPublic(): Promise<PublicStoreSettings> {
    return this.settingsService.getPublic();
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  get(): Promise<StoreSettingsView> {
    return this.settingsService.get();
  }

  // Writes are SUPER_ADMIN only. prd.md puts staff explicitly outside
  // "sensitive settings", and these values move money: shipping thresholds and
  // the orders kill-switch.
  @Patch('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  update(@Body() dto: UpdateSettingsDto): Promise<StoreSettingsView> {
    return this.settingsService.update(dto);
  }
}
