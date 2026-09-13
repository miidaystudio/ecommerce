import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { toCsv } from '../../common/utils/csv';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import {
  BestSellersReport,
  CustomerReport,
  ReportsService,
  SalesReport,
} from './reports.service';

// Reports read revenue and customer data across the whole store, so they are
// staff-and-above only — same boundary as the rest of the admin surface.
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.SUPER_ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  sales(@Query() query: ReportRangeQueryDto): Promise<SalesReport> {
    return this.reportsService.salesReport(query);
  }

  @Get('best-sellers')
  bestSellers(@Query() query: ReportRangeQueryDto): Promise<BestSellersReport> {
    return this.reportsService.bestSellers(query);
  }

  @Get('customers')
  customers(@Query() query: ReportRangeQueryDto): Promise<CustomerReport> {
    return this.reportsService.customerReport(query);
  }

  // CSV variants return text rather than JSON. Content-Disposition is set so a
  // browser saves the file instead of rendering it, and the filename carries
  // the range so a folder of exports stays intelligible.
  @Get('sales.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async salesCsv(@Query() query: ReportRangeQueryDto): Promise<string> {
    const report = await this.reportsService.salesReport(query);
    return toCsv(
      ['Period', 'Orders', 'Gross revenue', 'Discount', 'Shipping', 'Net revenue'],
      report.buckets.map((b) => [
        b.period,
        b.orderCount,
        b.grossRevenue,
        b.discount,
        b.shipping,
        b.netRevenue,
      ]),
    );
  }

  @Get('best-sellers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async bestSellersCsv(@Query() query: ReportRangeQueryDto): Promise<string> {
    const report = await this.reportsService.bestSellers(query);
    return toCsv(
      ['Product', 'Units sold', 'Revenue', 'Order lines'],
      report.items.map((item) => [item.productName, item.unitsSold, item.revenue, item.orderCount]),
    );
  }

  @Get('customers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async customersCsv(@Query() query: ReportRangeQueryDto): Promise<string> {
    const report = await this.reportsService.customerReport(query);
    return toCsv(
      ['Email', 'Name', 'Orders', 'Total spend', 'Avg order value', 'First order', 'Last order'],
      report.items.map((item) => [
        item.email,
        item.name ?? '',
        item.orderCount,
        item.totalSpend,
        item.avgOrderValue,
        item.firstOrderAt,
        item.lastOrderAt,
      ]),
    );
  }
}
