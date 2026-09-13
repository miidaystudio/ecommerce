import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class CartQuoteItemDto {
  @IsUUID()
  variantId!: string;

  // Same bounds as AddCartItemDto.
  @IsInt()
  @Min(1)
  @Max(999)
  @Type(() => Number)
  quantity!: number;
}

/**
 * Variant ids and quantities only. There is deliberately no price field: the
 * quote is priced from live variant prices, so a client cannot influence the
 * figures it is shown (and forbidNonWhitelisted rejects any extra field).
 */
export class CartQuoteDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartQuoteItemDto)
  items!: CartQuoteItemDto[];
}
