-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'miiday',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@miiday.test',
    "supportPhone" TEXT,
    "addressLine" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "freeShippingThreshold" DECIMAL(10,2) NOT NULL DEFAULT 999,
    "flatShippingFee" DECIMAL(10,2) NOT NULL DEFAULT 79,
    "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "ordersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceNotice" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);
