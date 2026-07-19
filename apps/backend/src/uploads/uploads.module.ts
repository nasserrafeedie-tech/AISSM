import { Module } from '@nestjs/common';
import { ConciergeModule } from '../concierge/concierge.module';
import { UploadsController } from './uploads.controller';
import { StorageService } from '../common/storage.service';

/** Browser uploads for the clips/photos that don't fit over MMS. */
@Module({
  imports: [ConciergeModule],
  controllers: [UploadsController],
  providers: [StorageService],
})
export class UploadsModule {}
