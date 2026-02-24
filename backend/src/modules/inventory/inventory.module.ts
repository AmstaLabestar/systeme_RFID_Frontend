import { Module } from '@nestjs/common';
import { IdentifiersModule } from '../identifiers/identifiers.module';
import { SystemsModule } from '../systems/systems.module';
import { InventoryService } from './inventory.service';

@Module({
  imports: [SystemsModule, IdentifiersModule],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
