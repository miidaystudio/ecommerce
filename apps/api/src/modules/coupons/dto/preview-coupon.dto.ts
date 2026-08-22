import { IsString, Matches } from 'class-validator';

// Only the code is accepted — the cart subtotal the discount applies to is
// always read server-side from the user's own cart, never sent by the client.
export class PreviewCouponDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, { message: 'Invalid coupon code' })
  code!: string;
}
