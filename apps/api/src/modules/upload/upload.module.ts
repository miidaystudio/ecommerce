import { Module } from '@nestjs/common';
import { LocalImageStorageService } from './local-image-storage.service';

@Module({
  providers: [LocalImageStorageService],
  exports: [LocalImageStorageService],
})
export class UploadModule {}
