import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import inventoryConfig from './config/inventory.config';
import jwtConfig from './config/jwt.config';
import paymentsConfig from './config/payments.config';
import throttleConfig from './config/throttle.config';
import { validateEnv } from './config/env.validation';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BannersModule } from './modules/banners/banners.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StaffModule } from './modules/staff/staff.module';
import { UploadModule } from './modules/upload/upload.module';
import { UsersModule } from './modules/users/users.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, paymentsConfig, inventoryConfig, throttleConfig],
      validate: validateEnv,
    }),
    // One throttler; stricter routes override its limit with @Throttle() using
    // the tiers in throttle.config.ts. See that file for why a single named
    // throttler is used rather than one per tier.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('throttle.defaultTtl', 60_000),
            limit: config.get<number>('throttle.defaultLimit', 120),
          },
        ],
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BrandsModule,
    CategoriesModule,
    UploadModule,
    ProductsModule,
    CartModule,
    WishlistModule,
    PaymentsModule,
    InventoryModule,
    CouponsModule,
    OrdersModule,
    CustomersModule,
    DashboardModule,
    ReviewsModule,
    BannersModule,
    ReportsModule,
    SettingsModule,
    StaffModule,
  ],
  providers: [
    // Global so an endpoint added later is protected by the default tier
    // without anyone having to remember to decorate it.
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
  ],
})
export class AppModule {}
