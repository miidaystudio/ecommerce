import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WishlistItemView, WishlistService } from './wishlist.service';

@Controller('wishlist/me')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<WishlistItemView[]> {
    return this.wishlistService.list(user.id);
  }

  @Post('items')
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddWishlistItemDto,
  ): Promise<WishlistItemView[]> {
    return this.wishlistService.addItem(user.id, dto);
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<WishlistItemView[]> {
    return this.wishlistService.removeItem(user.id, productId);
  }
}
