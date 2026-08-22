import { Module } from '@nestjs/common';
import { EmailModule } from '../../common/email/email.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [InventoryModule, EmailModule],
  controllers: [PaymentsController],
  providers: [RazorpayService, PaymentsService],
  exports: [RazorpayService, PaymentsService],
})
export class PaymentsModule {}
