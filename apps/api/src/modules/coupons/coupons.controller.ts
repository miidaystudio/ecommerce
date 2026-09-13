import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SENSITIVE_THROTTLE } from '../../config/throttle.config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CartService } from '../cart/cart.service';
import { AppliedCoupon, CouponsService } from './coupons.service';
import { PreviewCouponDto } from './dto/preview-coupon.dto';

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly cartService: CartService,
  ) {}

  /** Lets the checkout UI show the discount before placing the order. The
   * subtotal comes from the caller's own server-side cart, never the request
   * body — and this preview grants nothing: the order flow re-validates the
   * code from scratch, so a stale or tampered preview can't affect a total. */
  @Post('preview')
  @Throttle(SENSITIVE_THROTTLE)
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewCouponDto,
  ): Promise<AppliedCoupon> {
    const cart = await this.cartService.getCart(user.id);
    return this.couponsService.validateForUser(dto.code, user.id, cart.subtotal);
  }
}
