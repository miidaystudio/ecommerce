-- CreateTable
CREATE TABLE "schema_probe" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_probe_pkey" PRIMARY KEY ("id")
);
