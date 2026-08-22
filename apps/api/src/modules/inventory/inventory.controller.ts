import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { ManualAdjustmentDto } from './dto/manual-adjustment.dto';
import { AdjustmentView, InventoryService, PaginatedInventory } from './inventory.service';

@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.SUPER_ADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@Query() query: ListInventoryQueryDto): Promise<PaginatedInventory> {
    return this.inventoryService.list(query.page ?? 1, query.pageSize ?? 20, query.q);
  }

  @Get(':variantId/adjustments')
  listAdjustments(
    @Param('variantId') variantId: string,
    @Query() query: ListInventoryQueryDto,
  ): Promise<{ items: AdjustmentView[]; total: number }> {
    return this.inventoryService.listAdjustments(variantId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post(':variantId/adjustments')
  adjust(@Param('variantId') variantId: string, @Body() dto: ManualAdjustmentDto): Promise<AdjustmentView> {
    return this.inventoryService.manualAdjust(variantId, dto.change, dto.note);
  }
}
