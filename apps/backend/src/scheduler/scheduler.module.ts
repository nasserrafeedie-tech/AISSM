import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisProvider, REDIS_CONNECTION } from './redis.provider';
import { PublishQueueService } from './publish-queue.service';
import { PublishWorker } from './publish.worker';
import { CronService } from './cron.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RedisProvider, PublishQueueService, PublishWorker, CronService],
  exports: [PublishQueueService, REDIS_CONNECTION],
})
export class SchedulerModule {}
