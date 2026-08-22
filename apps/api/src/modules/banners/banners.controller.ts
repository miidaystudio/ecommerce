import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BannerView, BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller()
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get('banners')
  listActive(): Promise<BannerView[]> {
    return this.bannersService.listActive();
  }

  @Get('admin/banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  listAll(): Promise<BannerView[]> {
    return this.bannersService.listAll();
  }

  @Post('admin/banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  create(@Body() dto: CreateBannerDto): Promise<BannerView> {
    return this.bannersService.create(dto);
  }

  @Patch('admin/banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto): Promise<BannerView> {
    return this.bannersService.update(id, dto);
  }

  @Delete('admin/banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.bannersService.remove(id);
  }
}
