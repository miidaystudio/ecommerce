import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StaffService } from './staff.service';

describe('StaffService (privilege-escalation critical)', () => {
  let service: StaffService;

  const prismaMock = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    refreshToken: { deleteMany: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(StaffService);
    jest.clearAllMocks();
    prismaMock.user.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        id: where.id,
        email: 'x@test.com',
        firstName: null,
        lastName: null,
        role: data.role ?? Role.STAFF,
        isBlocked: data.isBlocked ?? false,
        createdAt: new Date(),
      }),
    );
  });

  function staffRow(overrides: Partial<{ id: string; role: Role; isBlocked: boolean; orders: number }> = {}) {
    return {
      id: overrides.id ?? 'staff-1',
      email: 'staff@test.com',
      passwordHash: 'hashed',
      firstName: 'Sam',
      lastName: 'Staff',
      role: overrides.role ?? Role.STAFF,
      isBlocked: overrides.isBlocked ?? false,
      createdAt: new Date(),
      _count: { orders: overrides.orders ?? 0 },
    };
  }

  describe('list', () => {
    it('only ever returns staff and super admins, never customers', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.list();

      const where = prismaMock.user.findMany.mock.calls[0][0].where;
      expect(where.role.in).toEqual([Role.STAFF, Role.SUPER_ADMIN]);
      expect(where.role.in).not.toContain(Role.CUSTOMER);
    });

    it('never exposes the password hash', async () => {
      prismaMock.user.findMany.mockResolvedValue([staffRow()]);

      const result = await service.list();

      expect(JSON.stringify(result)).not.toContain('hashed');
      expect(result[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('create', () => {
    it('refuses an email that already exists rather than silently promoting that account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'customer-1', role: Role.CUSTOMER });

      await expect(
        service.create({ email: 'shopper@test.com', password: 'LongEnoughPass1', role: Role.STAFF }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('normalises the email and stores only a hash, never the raw password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(staffRow());

      await service.create({ email: '  Staff@Test.com ', password: 'LongEnoughPass1', role: Role.STAFF });

      const data = prismaMock.user.create.mock.calls[0][0].data;
      expect(data.email).toBe('staff@test.com');
      expect(data.passwordHash).not.toBe('LongEnoughPass1');
      expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(data).not.toHaveProperty('password');
    });
  });

  describe('update — self-lockout guards', () => {
    it('refuses to let an admin demote themselves', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'me', role: Role.SUPER_ADMIN }));

      await expect(service.update('me', 'me', { role: Role.STAFF })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('refuses to let an admin block themselves', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'me', role: Role.SUPER_ADMIN }));

      await expect(service.update('me', 'me', { isBlocked: true })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('still lets an admin edit their own name', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'me', role: Role.SUPER_ADMIN }));

      await expect(service.update('me', 'me', { firstName: 'Renamed' })).resolves.toBeDefined();
    });
  });

  describe('update — last-admin guards', () => {
    it('refuses to demote the last active super admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.SUPER_ADMIN }));
      prismaMock.user.count.mockResolvedValue(0);

      await expect(service.update('me', 'other', { role: Role.STAFF })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('refuses to block the last active super admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.SUPER_ADMIN }));
      prismaMock.user.count.mockResolvedValue(0);

      await expect(service.update('me', 'other', { isBlocked: true })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('allows the demotion once another active super admin exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.SUPER_ADMIN }));
      prismaMock.user.count.mockResolvedValue(1);

      await expect(service.update('me', 'other', { role: Role.STAFF })).resolves.toBeDefined();
    });

    it('excludes the target itself when counting the remaining admins', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.SUPER_ADMIN }));
      prismaMock.user.count.mockResolvedValue(1);

      await service.update('me', 'other', { role: Role.STAFF });

      const where = prismaMock.user.count.mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 'other' });
      // A blocked admin cannot undo anything, so it must not count as cover.
      expect(where.isBlocked).toBe(false);
    });
  });

  describe('update — scope', () => {
    it('404s for a customer id, so this endpoint cannot reach shopper accounts', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...staffRow(), role: Role.CUSTOMER });

      await expect(service.update('me', 'customer-1', { role: Role.STAFF })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s for an unknown id', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.update('me', 'nope', { role: Role.STAFF })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('revokes refresh tokens on a role change, so the old role dies with the session', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.STAFF }));

      await service.update('me', 'other', { role: Role.SUPER_ADMIN });

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'other' } });
    });

    it('revokes refresh tokens when blocking an account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.STAFF }));

      await service.update('me', 'other', { isBlocked: true });

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'other' } });
    });

    it('does not revoke sessions for a harmless name edit', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.STAFF }));

      await service.update('me', 'other', { firstName: 'Renamed' });

      expect(prismaMock.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('refuses to delete your own account', async () => {
      await expect(service.remove('me', 'me')).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('refuses to delete the last active super admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', role: Role.SUPER_ADMIN }));
      prismaMock.user.count.mockResolvedValue(0);

      await expect(service.remove('me', 'other')).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.user.delete).not.toHaveBeenCalled();
    });

    it('hard-deletes a staff account that never placed an order', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', orders: 0 }));

      await service.remove('me', 'other');

      expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'other' } });
    });

    // rule.md: order history is immutable, so an account attached to orders is
    // blocked rather than deleted — access goes, the record stays.
    it('blocks instead of deleting when the account has order history', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRow({ id: 'other', orders: 3 }));

      await service.remove('me', 'other');

      expect(prismaMock.user.delete).not.toHaveBeenCalled();
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'other' },
        data: { isBlocked: true },
      });
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'other' } });
    });

    it('404s for a customer id', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...staffRow(), role: Role.CUSTOMER });

      await expect(service.remove('me', 'customer-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
