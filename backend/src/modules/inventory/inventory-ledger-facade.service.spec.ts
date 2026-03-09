import { InventoryLedgerFacade } from './inventory-ledger-facade.service';

describe('InventoryLedgerFacade', () => {
  const stockLedgerService = {
    append: jest.fn(),
  };

  let service: InventoryLedgerFacade;

  beforeEach(() => {
    service = new InventoryLedgerFacade(stockLedgerService as any);
  });

  it('appends device batch creation events for devices and bundled identifiers', async () => {
    const tx = { tx: true };
    await service.appendDeviceBatchCreation({
      systemId: 'system-1',
      devices: [{ id: 'device-1', warehouseCode: 'MAIN' }] as any,
      identifiersByDeviceId: new Map([
        [
          'device-1',
          [
            {
              id: 'identifier-1',
              warehouseCode: 'MAIN',
            },
          ],
        ],
      ]) as any,
      actorId: 'admin-1',
      tx: tx as any,
    });

    expect(stockLedgerService.append).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          resourceType: 'DEVICE',
          resourceId: 'device-1',
          action: 'STOCK_CREATED',
        }),
        expect.objectContaining({
          resourceType: 'IDENTIFIER',
          resourceId: 'identifier-1',
          action: 'STOCK_CREATED',
        }),
      ],
      tx,
    );
  });

  it('appends extension creation events for device and system identifiers', async () => {
    const tx = { tx: true };
    stockLedgerService.append.mockResolvedValue(undefined);

    await service.appendDeviceExtensionCreation({
      systemId: 'system-1',
      deviceId: 'device-1',
      identifiers: [{ id: 'identifier-1', warehouseCode: 'MAIN' }] as any,
      actorId: 'admin-1',
      tx: tx as any,
    });
    await service.appendSystemExtensionCreation({
      systemId: 'system-1',
      identifiers: [{ id: 'identifier-2', warehouseCode: 'MAIN' }] as any,
      actorId: 'admin-1',
      tx: tx as any,
    });

    expect(stockLedgerService.append).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ resourceId: 'identifier-1', action: 'EXTENSION_STOCK_CREATED' })],
      tx,
    );
    expect(stockLedgerService.append).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ resourceId: 'identifier-2', action: 'EXTENSION_STOCK_CREATED' })],
      tx,
    );
  });
});
