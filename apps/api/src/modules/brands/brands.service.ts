import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Brand } from '@prisma/client';
import { slugify } from '../../common/utils/slugify';
import { PrismaService } from '../../database/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Brand[]> {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async getBySlug(slug: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({ where: { slug } });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async getById(id: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async create(dto: CreateBrandDto): Promise<Brand> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    await this.assertSlugAvailable(slug);
    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    await this.getById(id);
    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = slugify(dto.slug ?? dto.name!);
      await this.assertSlugAvailable(slug, id);
    }
    return this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
      },
    });
  }

  async remove(id: string): Promise<{ success: true }> {
    await this.getById(id);
    await this.prisma.brand.delete({ where: { id } });
    return { success: true };
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('A brand with this slug already exists');
    }
  }
}
