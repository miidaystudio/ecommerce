import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CustomerSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isBlocked: boolean;
  orderCount: number;
  createdAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
  }[];
}

export interface PaginatedCustomers {
  items: CustomerSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number, search?: string): Promise<PaginatedCustomers> {
    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isBlocked: u.isBlocked,
        orderCount: u._count.orders,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getById(id: string): Promise<CustomerDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { orders: true } },
      },
    });
    if (!user || user.role !== Role.CUSTOMER) {
      throw new NotFoundException('Customer not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isBlocked: user.isBlocked,
      orderCount: user._count.orders,
      createdAt: user.createdAt.toISOString(),
      orders: user.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  async setBlocked(id: string, isBlocked: boolean): Promise<CustomerSummary> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.CUSTOMER) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isBlocked },
      include: { _count: { select: { orders: true } } },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      isBlocked: updated.isBlocked,
      orderCount: updated._count.orders,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
