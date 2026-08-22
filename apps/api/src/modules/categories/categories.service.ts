import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { slugify } from '../../common/utils/slugify';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async getBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async getById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    await this.assertSlugAvailable(slug);
    if (dto.parentId) {
      await this.getById(dto.parentId);
    }
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.getById(id);
    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = slugify(dto.slug ?? dto.name!);
      await this.assertSlugAvailable(slug, id);
    }
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.getById(dto.parentId);
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
      },
    });
  }

  async remove(id: string): Promise<{ success: true }> {
    await this.getById(id);
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new BadRequestException('Cannot delete a category that still has products assigned');
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('A category with this slug already exists');
    }
  }
}
