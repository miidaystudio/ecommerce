import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import { PaginatedReviews, ProductReviewSummary, ReviewView, ReviewsService } from './reviews.service';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(
    @Param('productId') productId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<PaginatedReviews<ReviewView>> {
    return this.reviewsService.listForProduct(productId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('summary')
  summary(@Param('productId') productId: string): Promise<ProductReviewSummary> {
    return this.reviewsService.summaryForProduct(productId);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<ReviewView | null> {
    return this.reviewsService.getMineForProduct(user.id, productId);
  }

  @Put('mine')
  @UseGuards(JwtAuthGuard)
  upsertMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: UpsertReviewDto,
  ): Promise<ReviewView> {
    return this.reviewsService.upsert(user.id, productId, dto);
  }

  @Delete('mine')
  @UseGuards(JwtAuthGuard)
  removeMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<{ success: true }> {
    return this.reviewsService.removeMine(user.id, productId);
  }
}
