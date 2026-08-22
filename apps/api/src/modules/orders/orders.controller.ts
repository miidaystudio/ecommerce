import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateOrderResponse, OrderDetail, OrdersService, PaginatedOrders } from './orders.service';

@Controller('orders/me')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersQueryDto): Promise<PaginatedOrders> {
    return this.ordersService.listMine(user.id, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderDetail> {
    return this.ordersService.getMineById(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto): Promise<CreateOrderResponse> {
    return this.ordersService.create(user.id, dto);
  }

  @Post(':id/retry-payment')
  retryPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CreateOrderResponse> {
    return this.ordersService.retryPayment(user.id, id);
  }

  @Post(':id/verify-payment')
  verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
  ): Promise<OrderDetail> {
    return this.ordersService.verifyPaymentSignature(
      user.id,
      id,
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderDetail> {
    return this.ordersService.cancelMine(user.id, id);
  }
}
