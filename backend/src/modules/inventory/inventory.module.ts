import { Module } from '@nestjs/common';
import { IdentifiersModule } from '../identifiers/identifiers.module';
import { SystemsModule } from '../systems/systems.module';
import { InventoryCommandService } from './inventory-command.service';
import { InventoryLedgerFacade } from './inventory-ledger-facade.service';
import { InventoryQueryService } from './inventory-query.service';
import { InventoryService } from './inventory.service';
import { InventoryValidationService } from './inventory-validation.service';
import { StockLedgerService } from './stock-ledger.service';

@Module({
  imports: [SystemsModule, IdentifiersModule],
  providers: [
    InventoryService,
    StockLedgerService,
    InventoryValidationService,
    InventoryLedgerFacade,
    InventoryQueryService,
    InventoryCommandService,
  ],
  exports: [InventoryService, StockLedgerService],
})
export class InventoryModule {}
