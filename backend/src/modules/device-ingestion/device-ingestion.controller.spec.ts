import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { DeviceIngestionAuthGuard } from './device-ingestion-auth.guard';
import { DeviceIngestionController } from './device-ingestion.controller';
import { DeviceIngestionService } from './device-ingestion.service';

describe('DeviceIngestionController', () => {
  const deviceIngestionService = {
    rotateIngestionKey: jest.fn(),
    ingestEvent: jest.fn(),
  };

  let controller: DeviceIngestionController;
  const allowGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DeviceIngestionController],
      providers: [
        {
          provide: DeviceIngestionService,
          useValue: deviceIngestionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(TwoFactorAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(DeviceIngestionAuthGuard)
      .useValue(allowGuard)
      .compile();

    controller = moduleRef.get(DeviceIngestionController);
  });

  it('rotates an ingestion key for the current user device', async () => {
    deviceIngestionService.rotateIngestionKey.mockResolvedValueOnce({ key: 'dik_123' });

    await expect(controller.rotateIngestionKey({ userId: 'user-1' } as any, 'device-1')).resolves.toEqual({
      key: 'dik_123',
    });
    expect(deviceIngestionService.rotateIngestionKey).toHaveBeenCalledWith('user-1', 'device-1');
  });

  it('rejects ingestion when device auth context is missing', async () => {
    expect(() => controller.ingestEvent({} as any, { eventId: 'event-1' } as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('ingests device events through the service when auth context exists', async () => {
    const request = {
      deviceAuth: {
        keyId: 'key-1',
      },
    };
    const dto = { eventId: 'event-1' };
    deviceIngestionService.ingestEvent.mockResolvedValueOnce({ status: 'accepted' });

    await expect(controller.ingestEvent(request as any, dto as any)).resolves.toEqual({
      status: 'accepted',
    });
    expect(deviceIngestionService.ingestEvent).toHaveBeenCalledWith(request.deviceAuth, dto);
  });
});
