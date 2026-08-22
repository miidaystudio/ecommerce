import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { AdminReviewView, PaginatedReviews, ReviewsService } from './reviews.service';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.SUPER_ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Query() query: ListReviewsQueryDto): Promise<PaginatedReviews<AdminReviewView>> {
    return this.reviewsService.listAll(query.page ?? 1, query.pageSize ?? 20, query.status);
  }

  @Patch(':id')
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto): Promise<AdminReviewView> {
    return this.reviewsService.moderate(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.reviewsService.remove(id);
  }
}
