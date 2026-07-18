import { Global, Module } from '@nestjs/common';
import { TaskBus } from './task-bus.service';
import { OperatorModule } from '../operator/operator.module';

/**
 * Global so both the Concierge and cron can emit Tasks without re-importing.
 * Imports OperatorModule so the TaskBus receives the OPERATOR_REGISTRY (the
 * executor) — decoupled via the abstract token, no circular dependency because
 * the Operator's handlers never depend on the TaskBus.
 */
@Global()
@Module({
  imports: [OperatorModule],
  providers: [TaskBus],
  exports: [TaskBus],
})
export class TasksModule {}
