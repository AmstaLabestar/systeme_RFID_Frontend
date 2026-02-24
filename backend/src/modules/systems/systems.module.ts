import { Module } from '@nestjs/common';
import { SystemsController } from './systems.controller';
import { SystemsStateService } from './systems-state.service';
import { SystemStatesRepository } from './repositories/system-states.repository';

@Module({
  controllers: [SystemsController],
  providers: [SystemsStateService, SystemStatesRepository],
  exports: [SystemsStateService, SystemStatesRepository],
})
export class SystemsModule {}
