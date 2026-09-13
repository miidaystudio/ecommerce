import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SENSITIVE_THROTTLE } from '../../config/throttle.config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderQuoteQueryDto } from './dto/order-quote-query.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateOrderResponse, OrderDetail, OrderQuote, OrdersService, PaginatedOrders } from './orders.service';

@Controller('orders/me')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersQueryDto): Promise<PaginatedOrders> {
    return this.ordersService.listMine(user.id, query);
  }

  // Declared before ':id' so "quote" is not captured as an order id.
  // Sensitive tier because it validates coupon codes — otherwise it would be
  // an unthrottled way around /coupons/preview's limit.
  @Get('quote')
  @Throttle(SENSITIVE_THROTTLE)
  quote(@CurrentUser() user: AuthenticatedUser, @Query() query: OrderQuoteQueryDto): Promise<OrderQuote> {
    return this.ordersService.quote(user.id, query.couponCode);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderDetail> {
    return this.ordersService.getMineById(user.id, id);
  }

  // COD orders deduct stock the moment they are placed, so an unthrottled
  // account could tie up inventory with a burst of orders it never intends to pay for.
  @Post()
  @Throttle(SENSITIVE_THROTTLE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto): Promise<CreateOrderResponse> {
    return this.ordersService.create(user.id, dto);
  }

  // Each retry creates a fresh order at Razorpay's API.
  @Post(':id/retry-payment')
  @Throttle(SENSITIVE_THROTTLE)
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
