import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CustomersService, CustomerDetail, CustomerSummary, PaginatedCustomers } from './customers.service';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { SetBlockedDto } from './dto/set-blocked.dto';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.SUPER_ADMIN)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query() query: ListCustomersQueryDto): Promise<PaginatedCustomers> {
    return this.customersService.list(query.page ?? 1, query.pageSize ?? 20, query.q);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<CustomerDetail> {
    return this.customersService.getById(id);
  }

  @Patch(':id/block')
  setBlocked(@Param('id') id: string, @Body() dto: SetBlockedDto): Promise<CustomerSummary> {
    return this.customersService.setBlocked(id, dto.isBlocked);
  }
}
