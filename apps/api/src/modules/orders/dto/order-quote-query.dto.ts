import { IsOptional, Matches } from 'class-validator';

// Only the coupon *code* — the quote is computed from the caller's server-side
// cart and store settings. Same format rule as CreateOrderDto.
export class OrderQuoteQueryDto {
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, { message: 'Invalid coupon code' })
  couponCode?: string;
}
