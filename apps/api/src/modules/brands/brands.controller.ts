import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Brand, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  list(): Promise<Brand[]> {
    return this.brandsService.list();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Brand> {
    return this.brandsService.getBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  create(@Body() dto: CreateBrandDto): Promise<Brand> {
    return this.brandsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto): Promise<Brand> {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.brandsService.remove(id);
  }
}
