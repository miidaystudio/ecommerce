import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorageService } from './cloudinary-storage.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      upload: jest.fn(),
    },
  },
}));

describe('CloudinaryStorageService', () => {
  let service: CloudinaryStorageService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: '1234567890',
      CLOUDINARY_API_SECRET: 'test-secret-value',
    };
    service = new CloudinaryStorageService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const validFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024 * 10,
    buffer: Buffer.from('fake-png-data'),
    stream: null as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
  };

  it('detects when Cloudinary is properly configured', () => {
    expect(service.isConfigured()).toBe(true);
  });

  it('detects when Cloudinary is not configured or uses placeholder', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'placeholder-name';
    expect(service.isConfigured()).toBe(false);

    delete process.env.CLOUDINARY_API_KEY;
    expect(service.isConfigured()).toBe(false);
  });

  it('rejects an invalid product ID (path traversal attempt)', async () => {
    await expect(service.save('../bad-id', validFile)).rejects.toThrow(BadRequestException);
    await expect(service.save('product/traversal', validFile)).rejects.toThrow(BadRequestException);
  });

  it('rejects an upload with no file', async () => {
    await expect(service.save('prod-123', null as unknown as Express.Multer.File)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unsupported MIME type', async () => {
    const invalidFile = { ...validFile, mimetype: 'application/pdf' };
    await expect(service.save('prod-123', invalidFile)).rejects.toThrow(
      'Only JPEG, PNG, and WEBP images are allowed',
    );
  });

  it('rejects an image exceeding 5MB', async () => {
    const hugeFile = { ...validFile, size: 6 * 1024 * 1024 };
    await expect(service.save('prod-123', hugeFile)).rejects.toThrow('Image must be 5MB or smaller');
  });

  it('streams valid file to Cloudinary and returns secure_url', async () => {
    const mockSecureUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v12345/ecommerce/products/prod-123/abc.png';

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, callback) => {
      // Simulate writable stream
      return {
        end: () => {
          callback(null, { secure_url: mockSecureUrl, public_id: 'ecommerce/products/prod-123/abc' });
        },
      };
    });

    const result = await service.save('prod-123', validFile);
    expect(result).toBe(mockSecureUrl);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'ecommerce/products/prod-123',
        resource_type: 'image',
        format: 'png',
      }),
      expect.any(Function),
    );
  });

  it('handles Cloudinary upload error and throws InternalServerErrorException', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, callback) => {
      return {
        end: () => {
          callback(new Error('Cloudinary connection timeout'), null);
        },
      };
    });

    await expect(service.save('prod-123', validFile)).rejects.toThrow(InternalServerErrorException);
  });
});
