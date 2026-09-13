import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrateImagesToCloudinary(): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (
    !cloudName ||
    !apiKey ||
    !apiSecret ||
    cloudName.includes('placeholder') ||
    apiKey.includes('placeholder') ||
    apiSecret.includes('placeholder')
  ) {
    console.log('[migrate:images] Cloudinary credentials not configured. Skipping migration.');
    return;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const prisma = new PrismaClient();

  try {
    const localImages = await prisma.productImage.findMany({
      where: {
        url: {
          startsWith: '/uploads/',
        },
      },
    });

    if (localImages.length === 0) {
      console.log('[migrate:images] No local product images found in database to migrate.');
      return;
    }

    console.log(`[migrate:images] Found ${localImages.length} local image(s) to migrate to Cloudinary...`);

    let migrated = 0;
    for (const image of localImages) {
      // url is e.g. /uploads/products/{productId}/{filename}.png
      // Map to disk: apps/api/uploads/products/{productId}/{filename}.png
      const relativePath = image.url.replace(/^\//, '');
      const localFilePath = path.resolve(__dirname, '..', relativePath);

      if (!existsSync(localFilePath)) {
        console.warn(`[migrate:images] Warning: local file not found at '${localFilePath}'. Skipping image ${image.id}.`);
        continue;
      }

      console.log(`[migrate:images] Uploading image ${image.id} (${localFilePath}) to Cloudinary...`);
      const result = await cloudinary.uploader.upload(localFilePath, {
        folder: `ecommerce/products/${image.productId}`,
        resource_type: 'image',
      });

      await prisma.productImage.update({
        where: { id: image.id },
        data: { url: result.secure_url },
      });

      console.log(`[migrate:images] Updated image ${image.id} -> ${result.secure_url}`);
      migrated++;
    }

    console.log(`[migrate:images] Successfully migrated ${migrated}/${localImages.length} image(s) to Cloudinary.`);
  } catch (error) {
    console.error('[migrate:images] Error during image migration:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void migrateImagesToCloudinary();
