import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const inventoryQueryService = {
    listSystemsWithStock: jest.fn(),
    listDeviceInventory: jest.fn(),
    getDeviceInventoryDetail: jest.fn(),
    listLowStockAlerts: jest.fn(),
  };

  const inventoryCommandService = {
    createDevicesInBulk: jest.fn(),
    addIdentifiersToDevice: jest.fn(),
    addIdentifiersToSystemStock: jest.fn(),
  };

  const inventoryValidationService = {
    validateDeviceImportBatch: jest.fn(),
  };

  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService(
      inventoryQueryService as any,
      inventoryCommandService as any,
      inventoryValidationService as any,
    );
  });

  it('delegates query operations to the query service', async () => {
    inventoryQueryService.listSystemsWithStock.mockResolvedValueOnce([{ id: 'system-1' }]);
    inventoryQueryService.listDeviceInventory.mockResolvedValueOnce({ items: [] });
    inventoryQueryService.getDeviceInventoryDetail.mockResolvedValueOnce({ id: 'device-1' });
    inventoryQueryService.listLowStockAlerts.mockResolvedValueOnce([{ systemId: 'system-1' }]);

    await expect(service.listSystemsWithStock(true)).resolves.toEqual([{ id: 'system-1' }]);
    await expect(service.listDeviceInventory({ page: 1, limit: 20 } as any)).resolves.toEqual({
      items: [],
    });
    await expect(service.getDeviceInventoryDetail('device-1')).resolves.toEqual({ id: 'device-1' });
    await expect(service.listLowStockAlerts()).resolves.toEqual([{ systemId: 'system-1' }]);
  });

  it('delegates mutation and validation operations to the dedicated services', async () => {
    inventoryCommandService.createDevicesInBulk.mockResolvedValueOnce([{ id: 'device-1' }]);
    inventoryCommandService.addIdentifiersToDevice.mockResolvedValueOnce([{ id: 'identifier-1' }]);
    inventoryCommandService.addIdentifiersToSystemStock.mockResolvedValueOnce([{ id: 'identifier-2' }]);
    inventoryValidationService.validateDeviceImportBatch.mockReturnValueOnce({ canCommit: true });

    await expect(service.createDevicesInBulk({ systemId: 'system-1', quantity: 1 } as any)).resolves.toEqual(
      [{ id: 'device-1' }],
    );
    await expect(service.addIdentifiersToDevice({ deviceId: 'device-1' } as any)).resolves.toEqual([
      { id: 'identifier-1' },
    ]);
    await expect(service.addIdentifiersToSystemStock({ systemId: 'system-1' } as any)).resolves.toEqual(
      [{ id: 'identifier-2' }],
    );
    expect(service.validateDeviceImportBatch({ systemId: 'system-1', devices: [] } as any)).toEqual({
      canCommit: true,
    });
  });
});
