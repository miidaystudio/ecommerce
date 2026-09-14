import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { LocalImageStorageService } from './local-image-storage.service';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

@Injectable()
export class CloudinaryStorageService {
  private readonly logger = new Logger(CloudinaryStorageService.name);
  private readonly localFallback = new LocalImageStorageService();

  constructor() {
    this.configureCloudinary();
  }

  private configureCloudinary(): void {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (
      cloudName &&
      apiKey &&
      apiSecret &&
      !cloudName.includes('placeholder') &&
      !apiKey.includes('placeholder') &&
      !apiSecret.includes('placeholder')
    ) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.logger.log(`Cloudinary configured for cloud '${cloudName}'`);
    } else {
      this.logger.warn(
        process.env.NODE_ENV === 'production'
          ? 'Cloudinary credentials missing: product image uploads will be refused.'
          : 'Cloudinary credentials not provided; using local disk storage for development.',
      );
    }
  }

  isConfigured(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    return Boolean(
      cloudName &&
        apiKey &&
        apiSecret &&
        !cloudName.includes('placeholder') &&
        !apiKey.includes('placeholder') &&
        !apiSecret.includes('placeholder'),
    );
  }

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

    if (!this.isConfigured()) {
      // Local disk is a development convenience only. On a host like Render the
      // disk is ephemeral, so a production fallback would accept the upload and
      // then lose the image on the next deploy or restart.
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('Image upload refused: Cloudinary is not configured in production');
        throw new ServiceUnavailableException('Image storage is not configured');
      }
      return this.localFallback.save(productId, file);
    }

    this.configureCloudinary();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `ecommerce/products/${productId}`,
          public_id: randomUUID(),
          resource_type: 'image',
          format: extension,
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed: ' + (error?.message ?? 'Unknown error'));
            return reject(new InternalServerErrorException('Failed to upload image to Cloudinary'));
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async uploadFromDisk(productId: string, filePath: string, mimeType = 'image/png'): Promise<string> {
    if (!SAFE_ID_PATTERN.test(productId)) {
      throw new BadRequestException('Invalid product id');
    }
    const buffer = await readFile(filePath);
    const extension = ALLOWED_MIME_TYPES[mimeType] ?? 'png';

    if (!this.isConfigured()) {
      throw new InternalServerErrorException('Cannot upload from disk: Cloudinary is not configured');
    }

    this.configureCloudinary();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `ecommerce/products/${productId}`,
          public_id: randomUUID(),
          resource_type: 'image',
          format: extension,
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload from disk failed: ' + (error?.message ?? 'Unknown error'));
            return reject(new InternalServerErrorException('Failed to upload image to Cloudinary'));
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }
}
