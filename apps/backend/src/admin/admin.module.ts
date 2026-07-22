import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { BusinessMetricsService } from './business-metrics.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [AdminController],
  providers: [BusinessMetricsService],
})
export class AdminModule {}
