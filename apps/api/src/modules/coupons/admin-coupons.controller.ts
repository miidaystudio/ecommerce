import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CouponView, CouponsService, PaginatedCoupons } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ListCouponsQueryDto } from './dto/list-coupons-query.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.SUPER_ADMIN)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list(@Query() query: ListCouponsQueryDto): Promise<PaginatedCoupons> {
    return this.couponsService.list(query.page ?? 1, query.pageSize ?? 20, query.q);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<CouponView> {
    return this.couponsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateCouponDto): Promise<CouponView> {
    return this.couponsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto): Promise<CouponView> {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.couponsService.remove(id);
  }
}
