import { Module } from '@nestjs/common';
import { IdentifiersModule } from '../identifiers/identifiers.module';
import { SystemsModule } from '../systems/systems.module';
import { InventoryService } from './inventory.service';
import { StockLedgerService } from './stock-ledger.service';

@Module({
  imports: [SystemsModule, IdentifiersModule],
  providers: [InventoryService, StockLedgerService],
  exports: [InventoryService, StockLedgerService],
})
export class InventoryModule {}
