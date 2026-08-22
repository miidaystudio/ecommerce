import { Module } from '@nestjs/common';
import { EmailModule } from '../../common/email/email.module';
import { CouponsModule } from '../coupons/coupons.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [InventoryModule, EmailModule, CouponsModule],
  controllers: [PaymentsController],
  providers: [RazorpayService, PaymentsService],
  exports: [RazorpayService, PaymentsService],
})
export class PaymentsModule {}
