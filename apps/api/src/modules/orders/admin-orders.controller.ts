import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListAdminOrdersQueryDto } from './dto/list-admin-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminOrderDetail, OrdersService, PaginatedAdminOrders } from './orders.service';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.SUPER_ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Query() query: ListAdminOrdersQueryDto): Promise<PaginatedAdminOrders> {
    return this.ordersService.adminList(query);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<AdminOrderDetail> {
    return this.ordersService.adminGetById(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto): Promise<AdminOrderDetail> {
    return this.ordersService.adminUpdateStatus(id, dto.status);
  }
}
