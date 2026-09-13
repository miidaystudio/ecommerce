import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PriceSummary } from '../settings/settings.service';
import { CartService } from './cart.service';
import { CartQuoteDto } from './dto/cart-quote.dto';

// A separate controller because CartController is guarded at class level, and
// this route has to work for guests too: a guest's cart only exists in the
// browser, yet the cart page still needs a server-computed GST breakdown.
@Controller('cart/quote')
export class CartQuoteController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  quote(@Body() dto: CartQuoteDto): Promise<PriceSummary> {
    return this.cartService.quote(dto.items);
  }
}
