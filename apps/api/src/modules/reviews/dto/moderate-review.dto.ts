import { IsEnum } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
