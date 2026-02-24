import { Module } from '@nestjs/common';
import { SystemsModule } from '../systems/systems.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  imports: [SystemsModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
