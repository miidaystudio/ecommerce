import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateOrderDto {
  @IsUUID()
  addressId!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  // Only the code — the discount amount is always recomputed server-side from
  // the live cart, never accepted from the client.
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, { message: 'Invalid coupon code' })
  couponCode?: string;
}
