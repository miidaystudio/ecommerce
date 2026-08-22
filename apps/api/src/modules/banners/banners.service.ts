import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

export interface BannerView {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
}

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Storefront-facing: active banners only, in display order. */
  async listActive(): Promise<BannerView[]> {
    const rows = await this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((b) => this.toView(b));
  }

  async listAll(): Promise<BannerView[]> {
    const rows = await this.prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    return rows.map((b) => this.toView(b));
  }

  async create(dto: CreateBannerDto): Promise<BannerView> {
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toView(banner);
  }

  async update(id: string, dto: UpdateBannerDto): Promise<BannerView> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }
    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        position: dto.position,
        isActive: dto.isActive,
      },
    });
    return this.toView(banner);
  }

  async remove(id: string): Promise<{ success: true }> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }
    await this.prisma.banner.delete({ where: { id } });
    return { success: true };
  }

  private toView(banner: Banner): BannerView {
    return {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      position: banner.position,
      isActive: banner.isActive,
    };
  }
}
