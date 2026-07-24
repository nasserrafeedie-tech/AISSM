import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ReelLabController } from './reel-lab.controller';
import { BusinessMetricsService } from './business-metrics.service';
import { TasksModule } from '../tasks/tasks.module';
import { OperatorModule } from '../operator/operator.module';

@Module({
  imports: [TasksModule, OperatorModule],
  controllers: [AdminController, ReelLabController],
  providers: [BusinessMetricsService],
})
export class AdminModule {}
