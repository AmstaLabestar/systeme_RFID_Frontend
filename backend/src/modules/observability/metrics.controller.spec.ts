import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  const metricsService = {
    renderPrometheus: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  let controller: MetricsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: metricsService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    controller = moduleRef.get(MetricsController);
  });

  it('renders prometheus metrics when metrics are enabled', () => {
    configService.get.mockReturnValueOnce(true);
    metricsService.renderPrometheus.mockReturnValueOnce('rfid_http_requests_total 1');

    const result = controller.getMetrics();

    expect(result).toBe('rfid_http_requests_total 1');
    expect(metricsService.renderPrometheus).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when metrics are disabled', () => {
    configService.get.mockReturnValueOnce(false);

    expect(() => controller.getMetrics()).toThrow(NotFoundException);
    expect(metricsService.renderPrometheus).not.toHaveBeenCalled();
  });
});
