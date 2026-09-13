import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;

  const prismaMock = {
    productVariant: { findUnique: jest.fn(), findMany: jest.fn() },
    cartItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  // Echoes its inputs so the tests can see exactly what the cart priced.
  const settingsMock = {
    summarize: jest.fn((subtotal: number, discount: number) =>
      Promise.resolve({ subtotal, discount, shippingFee: 0, total: subtotal, taxRatePercent: 18, taxIncluded: 0 }),
    ),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SettingsService, useValue: settingsMock },
      ],
    }).compile();

    service = moduleRef.get(CartService);
    jest.clearAllMocks();
    prismaMock.cartItem.findMany.mockResolvedValue([]);
  });

  const activeVariant = {
    id: 'variant-1',
    price: 100,
    compareAtPrice: null,
    stock: 5,
    product: { id: 'product-1', status: ProductStatus.ACTIVE },
  };

  describe('addItem', () => {
    it('throws NotFoundException when the variant does not exist', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-1', { variantId: 'missing', quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects adding a variant whose product is not ACTIVE', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        ...activeVariant,
        product: { id: 'product-1', status: ProductStatus.DRAFT },
      });

      await expect(service.addItem('user-1', { variantId: 'variant-1', quantity: 1 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects adding an out-of-stock variant', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({ ...activeVariant, stock: 0 });
      prismaMock.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-1', { variantId: 'variant-1', quantity: 1 })).rejects.toThrow(
        'out of stock',
      );
    });

    it('rejects a quantity that would exceed available stock, accounting for what is already in the cart', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue(activeVariant); // stock 5
      prismaMock.cartItem.findUnique.mockResolvedValue({ quantity: 4 });

      await expect(service.addItem('user-1', { variantId: 'variant-1', quantity: 2 })).rejects.toThrow(
        'Only 5 left in stock',
      );
    });

    it('upserts with the summed quantity and current price snapshot', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue(activeVariant);
      prismaMock.cartItem.findUnique.mockResolvedValue({ quantity: 2 });
      prismaMock.cartItem.upsert.mockResolvedValue({});

      await service.addItem('user-1', { variantId: 'variant-1', quantity: 1 });

      expect(prismaMock.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ quantity: 3, priceSnapshot: 100 }),
        }),
      );
    });
  });

  describe('updateItem', () => {
    it('throws NotFoundException for a cart item that does not exist', async () => {
      prismaMock.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.updateItem('user-1', 'variant-1', { quantity: 2 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a quantity above current stock', async () => {
      prismaMock.cartItem.findUnique.mockResolvedValue({ variant: { stock: 3 } });

      await expect(service.updateItem('user-1', 'variant-1', { quantity: 5 })).rejects.toThrow(
        'Only 3 left in stock',
      );
    });
  });

  describe('getCart / toCartResponse', () => {
    it('computes lineTotal/subtotal/itemCount from live variant price, and flags unavailable products', async () => {
      prismaMock.cartItem.findMany.mockResolvedValue([
        {
          id: 'ci-1',
          variantId: 'variant-1',
          quantity: 2,
          variant: {
            price: 150,
            compareAtPrice: 200,
            stock: 10,
            name: 'Oat / L',
            attributes: { color: 'Oat' },
            product: {
              id: 'product-1',
              name: 'Runner',
              slug: 'runner',
              status: ProductStatus.ACTIVE,
              images: [{ url: '/img.png', altText: null }],
            },
          },
        },
        {
          id: 'ci-2',
          variantId: 'variant-2',
          quantity: 1,
          variant: {
            price: 50,
            compareAtPrice: null,
            stock: 0,
            name: 'Default',
            attributes: null,
            product: {
              id: 'product-2',
              name: 'Discontinued Thing',
              slug: 'discontinued-thing',
              status: ProductStatus.ARCHIVED,
              images: [],
            },
          },
        },
      ]);

      const cart = await service.getCart('user-1');

      expect(cart.items[0].lineTotal).toBe(300);
      expect(cart.items[0].available).toBe(true);
      expect(cart.items[1].available).toBe(false);
      expect(cart.subtotal).toBe(350);
      expect(cart.itemCount).toBe(3);
    });
  });
  describe('quote (public, for guest and signed-in carts)', () => {
    it('prices lines from live variant prices, never from anything the client sent', async () => {
      prismaMock.productVariant.findMany.mockResolvedValue([
        { id: 'v1', price: 250 },
        { id: 'v2', price: 100 },
      ]);

      await service.quote([
        { variantId: 'v1', quantity: 2 },
        { variantId: 'v2', quantity: 3 },
      ]);

      expect(settingsMock.summarize).toHaveBeenCalledWith(800, 0);
    });

    it('only prices ACTIVE products', async () => {
      prismaMock.productVariant.findMany.mockResolvedValue([]);

      await service.quote([{ variantId: 'v1', quantity: 1 }]);

      const where = prismaMock.productVariant.findMany.mock.calls[0][0].where;
      expect(where.product).toEqual({ status: ProductStatus.ACTIVE });
    });

    it('leaves out unknown or inactive variants instead of failing the whole quote', async () => {
      prismaMock.productVariant.findMany.mockResolvedValue([{ id: 'v1', price: 100 }]);

      await service.quote([
        { variantId: 'v1', quantity: 1 },
        { variantId: 'gone', quantity: 5 },
      ]);

      expect(settingsMock.summarize).toHaveBeenCalledWith(100, 0);
    });

    it('merges repeated lines for the same variant so none is priced twice as a separate line', async () => {
      prismaMock.productVariant.findMany.mockResolvedValue([{ id: 'v1', price: 100 }]);

      await service.quote([
        { variantId: 'v1', quantity: 1 },
        { variantId: 'v1', quantity: 2 },
      ]);

      expect(prismaMock.productVariant.findMany.mock.calls[0][0].where.id.in).toEqual(['v1']);
      expect(settingsMock.summarize).toHaveBeenCalledWith(300, 0);
    });

    it('returns a zero quote for an empty cart without querying variants', async () => {
      await service.quote([]);

      expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
      expect(settingsMock.summarize).toHaveBeenCalledWith(0, 0);
    });
  });
});
