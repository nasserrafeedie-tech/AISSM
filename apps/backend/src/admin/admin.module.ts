import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { BusinessMetricsService } from './business-metrics.service';

@Module({
  controllers: [AdminController],
  providers: [BusinessMetricsService],
})
export class AdminModule {}
