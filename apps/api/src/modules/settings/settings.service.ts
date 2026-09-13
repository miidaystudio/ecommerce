import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { includedTax } from '../../common/utils/tax';
import { PrismaService } from '../../database/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SINGLETON_ID = 'default';

export interface StoreSettingsView {
  storeName: string;
  supportEmail: string;
  supportPhone: string | null;
  addressLine: string | null;
  currency: string;
  freeShippingThreshold: number;
  flatShippingFee: number;
  taxRatePercent: number;
  lowStockThreshold: number;
  ordersEnabled: boolean;
  maintenanceNotice: string | null;
  updatedAt: string | null;
}

export interface PriceSummary {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  /** GST contained in `total` (prices are tax-inclusive). */
  taxIncluded: number;
  taxRatePercent: number;
}

/** The subset the storefront is allowed to see — no operational thresholds. */
export interface PublicStoreSettings {
  storeName: string;
  supportEmail: string;
  supportPhone: string | null;
  addressLine: string | null;
  currency: string;
  freeShippingThreshold: number;
  flatShippingFee: number;
  ordersEnabled: boolean;
  maintenanceNotice: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reads the settings row, falling back to the environment values that held
   * these numbers through Phases 4-6. The row is created on first write rather
   * than at boot, so a fresh database still serves sane defaults.
   */
  async get(): Promise<StoreSettingsView> {
    const row = await this.prisma.storeSetting.findUnique({ where: { id: SINGLETON_ID } });

    if (!row) {
      return {
        storeName: 'miiday',
        supportEmail: 'support@miiday.test',
        supportPhone: null,
        addressLine: null,
        currency: this.config.get<string>('payments.currency', 'INR'),
        freeShippingThreshold: this.config.get<number>('payments.freeShippingThreshold', 999),
        flatShippingFee: this.config.get<number>('payments.flatShippingFee', 79),
        taxRatePercent: 0,
        lowStockThreshold: this.config.get<number>('inventory.lowStockThreshold', 5),
        ordersEnabled: true,
        maintenanceNotice: null,
        updatedAt: null,
      };
    }

    return this.toView(row);
  }

  async getPublic(): Promise<PublicStoreSettings> {
    const settings = await this.get();
    // Deliberately omits lowStockThreshold (operational) and taxRatePercent —
    // the storefront never computes tax itself; it receives server-computed
    // GST figures from the cart/checkout quotes and on each order.
    return {
      storeName: settings.storeName,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      addressLine: settings.addressLine,
      currency: settings.currency,
      freeShippingThreshold: settings.freeShippingThreshold,
      flatShippingFee: settings.flatShippingFee,
      ordersEnabled: settings.ordersEnabled,
      maintenanceNotice: settings.maintenanceNotice,
    };
  }

  async update(dto: UpdateSettingsDto): Promise<StoreSettingsView> {
    // Start from the resolved current values so an upsert's create branch
    // doesn't reset unsent fields back to schema defaults.
    const current = await this.get();

    const merged = {
      storeName: dto.storeName ?? current.storeName,
      supportEmail: dto.supportEmail ?? current.supportEmail,
      supportPhone: dto.supportPhone ?? current.supportPhone,
      addressLine: dto.addressLine ?? current.addressLine,
      currency: dto.currency ?? current.currency,
      freeShippingThreshold: dto.freeShippingThreshold ?? current.freeShippingThreshold,
      flatShippingFee: dto.flatShippingFee ?? current.flatShippingFee,
      taxRatePercent: dto.taxRatePercent ?? current.taxRatePercent,
      lowStockThreshold: dto.lowStockThreshold ?? current.lowStockThreshold,
      ordersEnabled: dto.ordersEnabled ?? current.ordersEnabled,
      maintenanceNotice: dto.maintenanceNotice ?? current.maintenanceNotice,
    };

    const row = await this.prisma.storeSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...merged },
      update: merged,
    });

    return this.toView(row);
  }

  /**
   * The one place an order's money is composed, used for checkout quotes, cart
   * quotes and order creation alike — so a figure shown before payment cannot
   * drift from the figure actually charged.
   *
   * Prices are tax-inclusive: `taxIncluded` is the GST already inside `total`,
   * shown as a breakdown, never added to it.
   */
  async summarize(subtotal: number, discount: number): Promise<PriceSummary> {
    const settings = await this.get();
    const shippingFee = subtotal >= settings.freeShippingThreshold ? 0 : settings.flatShippingFee;
    const total = Math.max(0, subtotal - discount) + shippingFee;
    return {
      subtotal,
      discount,
      shippingFee,
      total,
      taxRatePercent: settings.taxRatePercent,
      taxIncluded: includedTax(total, settings.taxRatePercent),
    };
  }

  private toView(row: {
    storeName: string;
    supportEmail: string;
    supportPhone: string | null;
    addressLine: string | null;
    currency: string;
    freeShippingThreshold: unknown;
    flatShippingFee: unknown;
    taxRatePercent: unknown;
    lowStockThreshold: number;
    ordersEnabled: boolean;
    maintenanceNotice: string | null;
    updatedAt: Date;
  }): StoreSettingsView {
    return {
      storeName: row.storeName,
      supportEmail: row.supportEmail,
      supportPhone: row.supportPhone,
      addressLine: row.addressLine,
      currency: row.currency,
      freeShippingThreshold: Number(row.freeShippingThreshold),
      flatShippingFee: Number(row.flatShippingFee),
      taxRatePercent: Number(row.taxRatePercent),
      lowStockThreshold: row.lowStockThreshold,
      ordersEnabled: row.ordersEnabled,
      maintenanceNotice: row.maintenanceNotice,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
