import { Module } from '@nestjs/common';
import { BusinessSystemsService } from './business-systems.service';
import { BusinessSystemsRepository } from './repositories/business-systems.repository';

@Module({
  providers: [BusinessSystemsService, BusinessSystemsRepository],
  exports: [BusinessSystemsService, BusinessSystemsRepository],
})
export class SystemsModule {}
