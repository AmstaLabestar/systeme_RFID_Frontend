import { Module } from '@nestjs/common';
import { BusinessSystemsService } from './business-systems.service';
import { SystemsController } from './systems.controller';
import { SystemsStateService } from './systems-state.service';
import { BusinessSystemsRepository } from './repositories/business-systems.repository';
import { SystemStatesRepository } from './repositories/system-states.repository';

@Module({
  controllers: [SystemsController],
  providers: [
    SystemsStateService,
    SystemStatesRepository,
    BusinessSystemsService,
    BusinessSystemsRepository,
  ],
  exports: [
    SystemsStateService,
    SystemStatesRepository,
    BusinessSystemsService,
    BusinessSystemsRepository,
  ],
})
export class SystemsModule {}
