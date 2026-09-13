import { Module } from '@nestjs/common';
import { CloudinaryStorageService } from './cloudinary-storage.service';
import { LocalImageStorageService } from './local-image-storage.service';

@Module({
  providers: [CloudinaryStorageService, LocalImageStorageService],
  exports: [CloudinaryStorageService, LocalImageStorageService],
})
export class UploadModule {}
