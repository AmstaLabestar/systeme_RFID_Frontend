import { Test } from '@nestjs/testing';
import { GetMyDevicesQueryDto } from './dto/get-my-devices-query.dto';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

describe('DevicesController', () => {
  const devicesService = {
    getMyDevices: jest.fn(),
    configureMyDevice: jest.fn(),
  };

  let controller: DevicesController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: DevicesService,
          useValue: devicesService,
        },
      ],
    }).compile();

    controller = moduleRef.get(DevicesController);
  });

  it('gets the current user devices', async () => {
    const query = Object.assign(new GetMyDevicesQueryDto(), { devicesLimit: 10 });
    devicesService.getMyDevices.mockResolvedValueOnce({ devices: [] });

    await expect(controller.getMyDevices({ userId: 'user-1' } as any, query)).resolves.toEqual({
      devices: [],
    });
    expect(devicesService.getMyDevices).toHaveBeenCalledWith('user-1', query);
  });

  it('configures a device for the current user', async () => {
    const dto = {
      name: 'Desk unit',
      location: 'Reception',
      systemIdentifier: 'AA:BB:CC:DD:EE:FF',
    };
    devicesService.configureMyDevice.mockResolvedValueOnce({ id: 'device-1' });

    await expect(
      controller.configureDevice({ userId: 'user-1' } as any, 'device-1', dto as any),
    ).resolves.toEqual({
      id: 'device-1',
    });
    expect(devicesService.configureMyDevice).toHaveBeenCalledWith('user-1', 'device-1', dto);
  });
});
