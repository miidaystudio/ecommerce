import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CartQuoteController } from './cart-quote.controller';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [SettingsModule],
  controllers: [CartController, CartQuoteController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
