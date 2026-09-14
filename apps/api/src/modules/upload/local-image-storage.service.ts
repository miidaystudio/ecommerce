import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, Injectable } from '@nestjs/common';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// productId is interpolated into a filesystem path below — it must never contain
// path separators or traversal sequences, regardless of how it reached this service.
const SAFE_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

// Development-only storage used by CloudinaryStorageService when Cloudinary is
// unconfigured outside production.
@Injectable()
export class LocalImageStorageService {
  private readonly uploadsRoot = join(process.cwd(), 'uploads');

  async save(productId: string, file: Express.Multer.File): Promise<string> {
    if (!SAFE_ID_PATTERN.test(productId)) {
      throw new BadRequestException('Invalid product id');
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images are allowed');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('Image must be 5MB or smaller');
    }

    const directory = join(this.uploadsRoot, 'products', productId);
    await mkdir(directory, { recursive: true });

    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(directory, filename), file.buffer);

    return `/uploads/products/${productId}/${filename}`;
  }
}
