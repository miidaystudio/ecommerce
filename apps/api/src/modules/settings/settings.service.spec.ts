import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const prismaMock = {
    storeSetting: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  const configMock = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const env: Record<string, unknown> = {
        'payments.currency': 'INR',
        'payments.freeShippingThreshold': 999,
        'payments.flatShippingFee': 79,
        'inventory.lowStockThreshold': 5,
      };
      return env[key] ?? fallback;
    }),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
    jest.clearAllMocks();
  });

  function settingsRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'default',
      storeName: 'miiday',
      supportEmail: 'help@miiday.test',
      supportPhone: '9876543210',
      addressLine: '12 Test Lane',
      currency: 'INR',
      freeShippingThreshold: 1500,
      flatShippingFee: 99,
      taxRatePercent: 18,
      lowStockThreshold: 3,
      ordersEnabled: true,
      maintenanceNotice: null,
      updatedAt: new Date('2026-09-12T10:00:00.000Z'),
      ...overrides,
    };
  }

  describe('get', () => {
    it('falls back to the environment values when no settings row exists yet', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(null);

      const settings = await service.get();

      expect(settings.freeShippingThreshold).toBe(999);
      expect(settings.flatShippingFee).toBe(79);
      expect(settings.lowStockThreshold).toBe(5);
      expect(settings.ordersEnabled).toBe(true);
      expect(settings.updatedAt).toBeNull();
    });

    it('converts Decimal money columns to numbers', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());

      const settings = await service.get();

      expect(settings.freeShippingThreshold).toBe(1500);
      expect(settings.flatShippingFee).toBe(99);
      expect(settings.taxRatePercent).toBe(18);
      expect(typeof settings.freeShippingThreshold).toBe('number');
    });
  });

  describe('getPublic', () => {
    it('omits operational values the storefront has no business seeing', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());

      const settings = await service.getPublic();

      expect(settings).not.toHaveProperty('lowStockThreshold');
      expect(settings).not.toHaveProperty('taxRatePercent');
      expect(settings).not.toHaveProperty('updatedAt');
    });

    it('still exposes what the storefront needs to describe shipping and support', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());

      const settings = await service.getPublic();

      expect(settings.storeName).toBe('miiday');
      expect(settings.supportEmail).toBe('help@miiday.test');
      expect(settings.freeShippingThreshold).toBe(1500);
      expect(settings.ordersEnabled).toBe(true);
    });
  });

  describe('update', () => {
    it('merges a partial patch over current values rather than resetting unsent fields', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      prismaMock.storeSetting.upsert.mockResolvedValue(settingsRow({ storeName: 'miiday co' }));

      await service.update({ storeName: 'miiday co' });

      const args = prismaMock.storeSetting.upsert.mock.calls[0][0];
      expect(args.update.storeName).toBe('miiday co');
      // Untouched fields keep their existing values, not schema defaults.
      expect(args.update.flatShippingFee).toBe(99);
      expect(args.update.lowStockThreshold).toBe(3);
      expect(args.create.flatShippingFee).toBe(99);
    });

    it('seeds the row from environment fallbacks on the very first save', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(null);
      prismaMock.storeSetting.upsert.mockResolvedValue(settingsRow());

      await service.update({ storeName: 'First save' });

      const args = prismaMock.storeSetting.upsert.mock.calls[0][0];
      expect(args.create.id).toBe('default');
      expect(args.create.freeShippingThreshold).toBe(999);
      expect(args.create.flatShippingFee).toBe(79);
    });

    it('can switch orders off with a notice', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      prismaMock.storeSetting.upsert.mockResolvedValue(
        settingsRow({ ordersEnabled: false, maintenanceNotice: 'Back Monday' }),
      );

      const result = await service.update({ ordersEnabled: false, maintenanceNotice: 'Back Monday' });

      expect(result.ordersEnabled).toBe(false);
      expect(result.maintenanceNotice).toBe('Back Monday');
    });

    it('treats an explicit false as a real value, not as "unset"', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow({ ordersEnabled: true }));
      prismaMock.storeSetting.upsert.mockResolvedValue(settingsRow({ ordersEnabled: false }));

      await service.update({ ordersEnabled: false });

      // `?? current` rather than `|| current`, so false is not silently
      // replaced by the existing true.
      expect(prismaMock.storeSetting.upsert.mock.calls[0][0].update.ordersEnabled).toBe(false);
    });

    it('treats an explicit zero shipping fee as a real value', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow({ flatShippingFee: 99 }));
      prismaMock.storeSetting.upsert.mockResolvedValue(settingsRow({ flatShippingFee: 0 }));

      await service.update({ flatShippingFee: 0 });

      expect(prismaMock.storeSetting.upsert.mock.calls[0][0].update.flatShippingFee).toBe(0);
    });

    it('always writes to the singleton row', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      prismaMock.storeSetting.upsert.mockResolvedValue(settingsRow());

      await service.update({ storeName: 'x' });

      expect(prismaMock.storeSetting.upsert.mock.calls[0][0].where).toEqual({ id: 'default' });
    });
  });

  describe('summarize (shipping + tax-inclusive GST)', () => {
    // settingsRow(): free shipping from 1500, flat fee 99, tax 18%.

    it('charges the flat fee below the free-shipping threshold', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      const summary = await service.summarize(1499, 0);
      expect(summary.shippingFee).toBe(99);
      expect(summary.total).toBe(1598);
    });

    it('is free exactly at and above the threshold', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      expect((await service.summarize(1500, 0)).shippingFee).toBe(0);
      expect((await service.summarize(5000, 0)).shippingFee).toBe(0);
    });

    it('decides shipping on the pre-discount subtotal, as checkout always has', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      const summary = await service.summarize(1500, 600);
      expect(summary.shippingFee).toBe(0);
      expect(summary.total).toBe(900);
    });

    it('never lets a discount push the total below zero', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      const summary = await service.summarize(1000, 5000);
      expect(summary.total).toBe(99);
    });

    // Prices are tax-inclusive: GST is the portion of the total that is tax,
    // never an amount added on top of it.
    it('reports the GST contained in the total without changing the total', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow({ freeShippingThreshold: 1000 }));
      const summary = await service.summarize(1180, 0); // over the threshold, so total is 1180
      expect(summary.total).toBe(1180);
      expect(summary.taxRatePercent).toBe(18);
      expect(summary.taxIncluded).toBe(180);
    });

    it('computes GST on the amount actually charged — after discount, including shipping', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(settingsRow());
      const summary = await service.summarize(1000, 100); // 900 + 99 shipping = 999
      expect(summary.total).toBe(999);
      expect(summary.taxIncluded).toBeCloseTo((999 * 18) / 118, 2);
    });

    it('reports zero GST when no tax rate is configured', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(null); // env fallback, rate 0
      const summary = await service.summarize(500, 0);
      expect(summary.shippingFee).toBe(79);
      expect(summary.taxRatePercent).toBe(0);
      expect(summary.taxIncluded).toBe(0);
    });
  });
});
