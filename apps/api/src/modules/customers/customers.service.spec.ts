import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;

  const prismaMock = {
    $transaction: jest.fn(),
    user: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CustomersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(CustomersService);
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: Promise<unknown>[]) => Promise.all(arg));
  });

  describe('list', () => {
    it('only ever queries CUSTOMER-role users, never staff/admin', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await service.list(1, 20);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ role: Role.CUSTOMER }) }),
      );
    });
  });

  describe('setBlocked', () => {
    it('throws NotFoundException for a non-customer (e.g. staff) account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STAFF });
      await expect(service.setBlocked('u1', true)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.setBlocked('missing', true)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('blocks a valid customer account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.CUSTOMER });
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        email: 'c@test.local',
        firstName: null,
        lastName: null,
        phone: null,
        isBlocked: true,
        createdAt: new Date(),
        _count: { orders: 2 },
      });

      const result = await service.setBlocked('u1', true);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: { isBlocked: true } }),
      );
      expect(result.isBlocked).toBe(true);
    });
  });

  describe('getById', () => {
    it('throws NotFoundException for a non-customer account (staff should not be viewable here)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.SUPER_ADMIN });
      await expect(service.getById('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
