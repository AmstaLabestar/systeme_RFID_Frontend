import { BadRequestException, ConflictException } from '@nestjs/common';
import { HardwareSystemCode, Prisma } from '@prisma/client';
import { BusinessSystemsService } from './business-systems.service';

describe('BusinessSystemsService', () => {
  const businessSystemsRepository = {
    findMany: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    updateById: jest.fn(),
  };

  let service: BusinessSystemsService;

  beforeEach(() => {
    service = new BusinessSystemsService(businessSystemsRepository as any);
  });

  it('rejects invalid FEEDBACK extension configuration', async () => {
    await expect(
      service.createSystem({
        name: 'Feedback',
        code: HardwareSystemCode.FEEDBACK,
        hasIdentifiers: true,
        identifiersPerDevice: 1,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an RFID presence system with normalized identifier defaults and pricing', async () => {
    businessSystemsRepository.create.mockResolvedValueOnce({ id: 'system-1' });

    await expect(
      service.createSystem({
        name: 'RFID Presence',
        code: HardwareSystemCode.RFID_PRESENCE,
        hasIdentifiers: true,
        identifiersPerDevice: 5,
      } as any),
    ).resolves.toEqual({ id: 'system-1' });
    expect(businessSystemsRepository.create).toHaveBeenCalledWith({
      name: 'RFID Presence',
      code: HardwareSystemCode.RFID_PRESENCE,
      hasIdentifiers: true,
      identifiersPerDevice: 5,
      identifierType: 'BADGE',
      deviceUnitPriceCents: 21000,
      extensionUnitPriceCents: 1000,
      currency: 'XOF',
      isActive: true,
    });
  });

  it('maps unique Prisma conflicts to a domain conflict', async () => {
    businessSystemsRepository.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Duplicate system', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.createSystem({
        name: 'RFID Presence',
        code: HardwareSystemCode.RFID_PRESENCE,
        hasIdentifiers: true,
        identifiersPerDevice: 5,
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates system pricing using the stored system code rules', async () => {
    businessSystemsRepository.findById.mockResolvedValueOnce({
      id: 'system-1',
      code: HardwareSystemCode.FEEDBACK,
      currency: 'XOF',
    });
    businessSystemsRepository.updateById.mockResolvedValueOnce({ id: 'system-1' });

    await expect(
      service.setSystemPricing('system-1', {
        deviceUnitPriceCents: 17000,
        extensionUnitPriceCents: 999,
        currency: 'eur',
      } as any),
    ).resolves.toEqual({ id: 'system-1' });
    expect(businessSystemsRepository.updateById).toHaveBeenCalledWith('system-1', {
      deviceUnitPriceCents: 17000,
      extensionUnitPriceCents: 0,
      currency: 'EUR',
    });
  });

  it('rejects inactive systems when an active one is required', async () => {
    businessSystemsRepository.findByCode.mockResolvedValueOnce({
      id: 'system-1',
      code: HardwareSystemCode.RFID_PRESENCE,
      isActive: false,
    });

    await expect(
      service.getSystemByCodeOrThrow(HardwareSystemCode.RFID_PRESENCE, true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
