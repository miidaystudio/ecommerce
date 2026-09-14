import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { slugify } from '../../common/utils/slugify';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListAdminProductsQueryDto } from './dto/list-admin-products-query.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductVariantDto } from './dto/product-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_SUMMARY_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' as const }, take: 1 },
} satisfies Prisma.ProductInclude;

const PRODUCT_DETAIL_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' as const } },
  variants: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ProductInclude;

type ProductWithSummaryRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_SUMMARY_INCLUDE }>;
type ProductWithDetailRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_INCLUDE }>;

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  category: { id: string; name: string; slug: string };
  brand: { id: string; name: string; slug: string } | null;
  image: { id: string; url: string; altText: string | null; position: number } | null;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  category: { id: string; name: string; slug: string };
  brand: { id: string; name: string; slug: string } | null;
  images: { id: string; url: string; altText: string | null; position: number }[];
  variants: {
    id: string;
    sku: string;
    name: string;
    attributes: Record<string, string> | null;
    price: number;
    compareAtPrice: number | null;
    stock: number;
    isDefault: boolean;
  }[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface PaginatedProducts<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BulkImportResult {
  created: number;
  failed: { row: number; error: string }[];
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ListProductsQueryDto): Promise<PaginatedProducts<ProductSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      category: query.category ? { slug: query.category } : undefined,
      brand: query.brand ? { slug: query.brand } : undefined,
      inStock: query.inStock === true ? true : undefined,
      name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      displayPrice:
        query.minPrice !== undefined || query.maxPrice !== undefined
          ? { gte: query.minPrice, lte: query.maxPrice }
          : undefined,
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { displayPrice: 'asc' }
        : query.sort === 'price_desc'
          ? { displayPrice: 'desc' }
          : { createdAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_SUMMARY_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((product) => this.toSummary(product)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async search(q: string): Promise<ProductSummary[]> {
    const items = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        name: { contains: q, mode: 'insensitive' },
      },
      include: PRODUCT_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return items.map((product) => this.toSummary(product));
  }

  async getPublicBySlug(slug: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }
    return this.toDetail(product);
  }

  /** Same-category products, excluding the one being viewed. Deliberately simple —
   * a real recommendation engine is out of scope for this build. */
  async listRelated(slug: string, limit = 4): Promise<ProductSummary[]> {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }

    const related = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, categoryId: product.categoryId, id: { not: product.id } },
      include: PRODUCT_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return related.map((p) => this.toSummary(p));
  }

  /** Resolves a caller-supplied list of product ids to summaries — backs the
   * storefront's "recently viewed" strip, whose id list lives in the browser. */
  async listByIds(ids: string[]): Promise<ProductSummary[]> {
    if (ids.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids.slice(0, 12) }, status: ProductStatus.ACTIVE },
      include: PRODUCT_SUMMARY_INCLUDE,
    });
    // Preserve the caller's ordering (most-recent first) rather than the DB's.
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => this.toSummary(p));
  }

  async listAdmin(query: ListAdminProductsQueryDto): Promise<PaginatedProducts<ProductSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      status: query.status,
      name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_SUMMARY_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((product) => this.toSummary(product)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getAdminById(id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.toDetail(product);
  }

  async create(dto: CreateProductDto): Promise<ProductDetail> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    await this.assertSlugAvailable(slug);
    await this.assertVariantSkusAvailable(dto.variants);

    const { displayPrice, displayCompareAtPrice, inStock } = this.computeDisplayFields(dto.variants);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        status: dto.status ?? ProductStatus.DRAFT,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        displayPrice,
        displayCompareAtPrice,
        inStock,
        variants: {
          create: dto.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            attributes: variant.attributes,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            stock: variant.stock,
            isDefault: variant.isDefault ?? false,
          })),
        },
      },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    return this.toDetail(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDetail> {
    const existing = await this.prisma.product.findUnique({ where: { id }, include: { variants: true } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = slugify(dto.slug ?? dto.name!);
      await this.assertSlugAvailable(slug, id);
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    if (dto.variants) {
      const ownIds = new Set(existing.variants.map((v) => v.id));
      if (dto.variants.some((v) => v.id && !ownIds.has(v.id))) {
        throw new BadRequestException('Variant does not belong to this product');
      }
      await this.assertVariantSkusAvailable(dto.variants, id);
    }

    // Reads stay outside the transaction: a query on this.prisma inside it needs
    // a second pooled connection, which deadlocks until the transaction times out
    // when the pool has one connection (e.g. `connection_limit=1` on a pooler).
    const product = await this.prisma.$transaction(async (tx) => {
      if (dto.variants) {
        const keepIds = dto.variants.filter((v) => v.id).map((v) => v.id!);
        await tx.productVariant.deleteMany({
          where: { productId: id, id: keepIds.length ? { notIn: keepIds } : undefined },
        });
        for (const variant of dto.variants) {
          if (variant.id) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: variant.sku,
                name: variant.name,
                attributes: variant.attributes,
                price: variant.price,
                compareAtPrice: variant.compareAtPrice,
                stock: variant.stock,
                isDefault: variant.isDefault ?? false,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                sku: variant.sku,
                name: variant.name,
                attributes: variant.attributes,
                price: variant.price,
                compareAtPrice: variant.compareAtPrice,
                stock: variant.stock,
                isDefault: variant.isDefault ?? false,
              },
            });
          }
        }
      }

      const currentVariants =
        dto.variants ??
        existing.variants.map((v) => ({
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
          stock: v.stock,
          isDefault: v.isDefault,
        }));
      const { displayPrice, displayCompareAtPrice, inStock } = this.computeDisplayFields(currentVariants);

      return tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          status: dto.status,
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          displayPrice,
          displayCompareAtPrice,
          inStock,
        },
        include: PRODUCT_DETAIL_INCLUDE,
      });
    });

    return this.toDetail(product);
  }

  async remove(id: string): Promise<{ success: true }> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  // Bulk CSV import: one row = one product with a single default variant.
  // Multi-variant products still go through the regular create/edit form —
  // CSV is for fast catalog seeding, not full variant modeling.
  async bulkImport(records: Record<string, string>[]): Promise<BulkImportResult> {
    const result: BulkImportResult = { created: 0, failed: [] };

    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 2; // +1 for header row, +1 for 1-based rows
      const record = records[i];
      try {
        const name = record.name?.trim();
        if (!name) {
          throw new BadRequestException('name is required');
        }
        const categorySlug = record.categorySlug?.trim();
        if (!categorySlug) {
          throw new BadRequestException('categorySlug is required');
        }
        const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
        if (!category) {
          throw new BadRequestException(`Unknown categorySlug "${categorySlug}"`);
        }

        let brandId: string | undefined;
        const brandSlug = record.brandSlug?.trim();
        if (brandSlug) {
          const brand = await this.prisma.brand.findUnique({ where: { slug: brandSlug } });
          if (!brand) {
            throw new BadRequestException(`Unknown brandSlug "${brandSlug}"`);
          }
          brandId = brand.id;
        }

        const sku = record.sku?.trim();
        if (!sku) {
          throw new BadRequestException('sku is required');
        }
        const price = Number(record.price);
        if (!Number.isFinite(price) || price < 0) {
          throw new BadRequestException('price must be a non-negative number');
        }
        const stock = Number(record.stock);
        if (!Number.isInteger(stock) || stock < 0) {
          throw new BadRequestException('stock must be a non-negative whole number');
        }
        const compareAtPrice = record.compareAtPrice ? Number(record.compareAtPrice) : undefined;
        if (compareAtPrice !== undefined && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
          throw new BadRequestException('compareAtPrice must be a non-negative number');
        }
        const status = record.status?.trim().toUpperCase();
        if (status && !Object.values(ProductStatus).includes(status as ProductStatus)) {
          throw new BadRequestException(`Unknown status "${record.status}"`);
        }

        await this.create({
          name,
          slug: record.slug?.trim() || undefined,
          description: record.description?.trim() || name,
          status: (status as ProductStatus) || undefined,
          categoryId: category.id,
          brandId,
          variants: [
            {
              sku,
              name: 'Default',
              price,
              compareAtPrice,
              stock,
              isDefault: true,
            },
          ],
        });
        result.created += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.failed.push({ row: rowNumber, error: message });
      }
    }

    return result;
  }

  async addImage(
    productId: string,
    data: { url: string; altText?: string },
  ): Promise<ProductDetail> {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    const maxPosition = await this.prisma.productImage.aggregate({
      where: { productId },
      _max: { position: true },
    });
    await this.prisma.productImage.create({
      data: {
        productId,
        url: data.url,
        altText: data.altText,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });
    return this.getAdminById(productId);
  }

  async removeImage(productId: string, imageId: string): Promise<ProductDetail> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new NotFoundException('Image not found');
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return this.getAdminById(productId);
  }

  private computeDisplayFields(
    variants: Pick<ProductVariantDto, 'price' | 'compareAtPrice' | 'stock' | 'isDefault'>[],
  ): { displayPrice: number; displayCompareAtPrice: number | null; inStock: boolean } {
    if (variants.length === 0) {
      return { displayPrice: 0, displayCompareAtPrice: null, inStock: false };
    }
    const defaultVariant =
      variants.find((v) => v.isDefault) ??
      variants.reduce((cheapest, v) => (v.price < cheapest.price ? v : cheapest));
    return {
      displayPrice: defaultVariant.price,
      displayCompareAtPrice: defaultVariant.compareAtPrice ?? null,
      inStock: variants.some((v) => v.stock > 0),
    };
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('A product with this slug already exists');
    }
  }

  private async assertVariantSkusAvailable(
    variants: Pick<ProductVariantDto, 'id' | 'sku'>[],
    excludeProductId?: string,
  ): Promise<void> {
    const skus = variants.map((v) => v.sku);
    const duplicates = skus.filter((sku, i) => skus.indexOf(sku) !== i);
    if (duplicates.length > 0) {
      throw new BadRequestException(`Duplicate SKU(s) in request: ${[...new Set(duplicates)].join(', ')}`);
    }
    const conflicting = await this.prisma.productVariant.findMany({
      where: { sku: { in: skus }, productId: excludeProductId ? { not: excludeProductId } : undefined },
      select: { sku: true },
    });
    if (conflicting.length > 0) {
      throw new ConflictException(
        `SKU(s) already in use: ${conflicting.map((c) => c.sku).join(', ')}`,
      );
    }
  }

  private toSummary(product: ProductWithSummaryRelations): ProductSummary {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      category: product.category,
      brand: product.brand,
      image: product.images[0] ?? null,
      price: Number(product.displayPrice),
      compareAtPrice: product.displayCompareAtPrice ? Number(product.displayCompareAtPrice) : null,
      inStock: product.inStock,
      ratingAverage: Number(product.ratingAverage),
      ratingCount: product.ratingCount,
    };
  }

  private toDetail(product: ProductWithDetailRelations): ProductDetail {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      category: product.category,
      brand: product.brand,
      images: product.images,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        attributes: (variant.attributes as Record<string, string> | null) ?? null,
        price: Number(variant.price),
        compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
        stock: variant.stock,
        isDefault: variant.isDefault,
      })),
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
    };
  }
}
