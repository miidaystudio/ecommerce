import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { csvRowsToRecords, parseCsv } from '../../common/utils/csv';
import { LocalImageStorageService } from '../upload/local-image-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListAdminProductsQueryDto } from './dto/list-admin-products-query.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { RecentlyViewedQueryDto } from './dto/recently-viewed-query.dto';
import { SearchProductsQueryDto } from './dto/search-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  BulkImportResult,
  PaginatedProducts,
  ProductDetail,
  ProductSummary,
  ProductsService,
} from './products.service';

const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;

@Controller()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly imageStorage: LocalImageStorageService,
  ) {}

  @Get('products')
  list(@Query() query: ListProductsQueryDto): Promise<PaginatedProducts<ProductSummary>> {
    return this.productsService.listPublic(query);
  }

  @Get('products/search')
  search(@Query() query: SearchProductsQueryDto): Promise<ProductSummary[]> {
    return this.productsService.search(query.q);
  }

  // Registered before the ':slug' route so "recently-viewed" isn't swallowed
  // by it as a slug value.
  @Get('products/recently-viewed')
  recentlyViewed(@Query() query: RecentlyViewedQueryDto): Promise<ProductSummary[]> {
    const ids = query.ids ? query.ids.split(',').map((id) => id.trim()).filter(Boolean) : [];
    return this.productsService.listByIds(ids);
  }

  @Get('products/:slug')
  getBySlug(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.productsService.getPublicBySlug(slug);
  }

  @Get('products/:slug/related')
  related(@Param('slug') slug: string): Promise<ProductSummary[]> {
    return this.productsService.listRelated(slug);
  }

  @Get('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  listAdmin(@Query() query: ListAdminProductsQueryDto): Promise<PaginatedProducts<ProductSummary>> {
    return this.productsService.listAdmin(query);
  }

  @Get('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  getAdminById(@Param('id') id: string): Promise<ProductDetail> {
    return this.productsService.getAdminById(id);
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  create(@Body() dto: CreateProductDto): Promise<ProductDetail> {
    return this.productsService.create(dto);
  }

  @Post('admin/products/bulk-import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  bulkImport(@UploadedFile() file: Express.Multer.File): Promise<BulkImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.size > MAX_CSV_SIZE_BYTES) {
      throw new BadRequestException('CSV must be 2MB or smaller');
    }
    const text = file.buffer.toString('utf-8');
    const records = csvRowsToRecords(parseCsv(text));
    return this.productsService.bulkImport(records);
  }

  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto): Promise<ProductDetail> {
    return this.productsService.update(id, dto);
  }

  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.productsService.remove(id);
  }

  @Post('admin/products/:id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async addImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProductDetail> {
    // Confirm the product exists before touching the filesystem.
    await this.productsService.getAdminById(id);
    const url = await this.imageStorage.save(id, file);
    return this.productsService.addImage(id, { url });
  }

  @Delete('admin/products/:id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF, Role.SUPER_ADMIN)
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string): Promise<ProductDetail> {
    return this.productsService.removeImage(id, imageId);
  }
}
