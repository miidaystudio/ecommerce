import { Injectable, NotFoundException } from '@nestjs/common';
import { Address } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const existingCount = await this.prisma.address.count({ where: { userId } });
    const shouldBeDefault = dto.isDefault === true || existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          label: dto.label ?? null,
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country ?? 'India',
          isDefault: shouldBeDefault,
        },
      });
    });
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto): Promise<Address> {
    await this.getOwnedAddress(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          label: dto.label ?? undefined,
          fullName: dto.fullName ?? undefined,
          phone: dto.phone ?? undefined,
          line1: dto.line1 ?? undefined,
          line2: dto.line2 ?? undefined,
          city: dto.city ?? undefined,
          state: dto.state ?? undefined,
          postalCode: dto.postalCode ?? undefined,
          country: dto.country ?? undefined,
          isDefault: dto.isDefault ?? undefined,
        },
      });
    });
  }

  async setDefault(userId: string, addressId: string): Promise<Address> {
    await this.getOwnedAddress(userId, addressId);
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
    });
  }

  async remove(userId: string, addressId: string): Promise<{ success: true }> {
    const address = await this.getOwnedAddress(userId, addressId);

    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id: addressId } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });

    return { success: true };
  }

  private async getOwnedAddress(userId: string, addressId: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }
}
