import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

const BCRYPT_ROUNDS = 12;

// Only these two are manageable here. CUSTOMER is deliberately excluded: the
// customers module owns customer accounts, and allowing a role change between
// the two surfaces would let staff administration reach ordinary shoppers.
const STAFF_ROLES: Role[] = [Role.STAFF, Role.SUPER_ADMIN];

export interface StaffView {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  isBlocked: boolean;
  createdAt: string;
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<StaffView[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toView(row));
  }

  async create(dto: CreateStaffDto): Promise<StaffView> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Refuses rather than promoting: silently turning a shopper's existing
      // account into an admin one is not something a create call should do.
      throw new ConflictException('An account with that email already exists');
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        role: dto.role,
        isVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    return this.toView(created);
  }

  /**
   * Changes a staff member's role or blocked state.
   *
   * `actingUserId` is the caller, and the checks below exist to stop an admin
   * locking the store's own administration out:
   *  - nobody may demote or block themselves (the classic self-lockout), and
   *  - the last remaining active SUPER_ADMIN cannot be demoted or blocked,
   *    because there would then be no account able to undo it.
   */
  async update(actingUserId: string, targetId: string, dto: UpdateStaffDto): Promise<StaffView> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      throw new NotFoundException('Staff member not found');
    }

    const losingAdmin =
      target.role === Role.SUPER_ADMIN &&
      ((dto.role !== undefined && dto.role !== Role.SUPER_ADMIN) || dto.isBlocked === true);

    if (targetId === actingUserId && (dto.role !== undefined || dto.isBlocked !== undefined)) {
      const demotingSelf = dto.role !== undefined && dto.role !== target.role;
      if (demotingSelf || dto.isBlocked === true) {
        throw new BadRequestException('You cannot change your own role or block your own account');
      }
    }

    if (losingAdmin) {
      const remaining = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isBlocked: false, id: { not: targetId } },
      });
      if (remaining === 0) {
        throw new BadRequestException(
          'This is the last active super admin — promote another one first',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        role: dto.role ?? undefined,
        isBlocked: dto.isBlocked ?? undefined,
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
      },
    });

    // A demoted or blocked account keeps working until its access token
    // expires unless its refresh tokens go too — revoke them so the change
    // takes effect on the next refresh rather than whenever they log out.
    if (dto.role !== undefined || dto.isBlocked === true) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: targetId } });
    }

    return this.toView(updated);
  }

  async remove(actingUserId: string, targetId: string): Promise<{ success: true }> {
    if (targetId === actingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { _count: { select: { orders: true } } },
    });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      throw new NotFoundException('Staff member not found');
    }

    if (target.role === Role.SUPER_ADMIN) {
      const remaining = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isBlocked: false, id: { not: targetId } },
      });
      if (remaining === 0) {
        throw new BadRequestException(
          'This is the last active super admin — promote another one first',
        );
      }
    }

    // rule.md: order history is immutable. Deleting a user who placed orders
    // would either cascade them away or orphan them, so such an account is
    // blocked instead — access is revoked, the record stays intact.
    if (target._count.orders > 0) {
      await this.prisma.user.update({ where: { id: targetId }, data: { isBlocked: true } });
      await this.prisma.refreshToken.deleteMany({ where: { userId: targetId } });
      return { success: true };
    }

    await this.prisma.user.delete({ where: { id: targetId } });
    return { success: true };
  }

  private toView(row: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    isBlocked: boolean;
    createdAt: Date;
  }): StaffView {
    // Note the absence of passwordHash — this shape is what the admin UI sees.
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      isBlocked: row.isBlocked,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
