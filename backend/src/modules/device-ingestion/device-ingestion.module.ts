import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DeviceEventDispatcherService } from './device-event-dispatcher.service';
import { DeviceIngestionController } from './device-ingestion.controller';
import { DeviceIngestionAuthGuard } from './device-ingestion-auth.guard';
import { DeviceMqttIngestionService } from './device-mqtt-ingestion.service';
import { DeviceIngestionService } from './device-ingestion.service';

@Module({
  imports: [CommonModule],
  controllers: [DeviceIngestionController],
  providers: [
    DeviceIngestionService,
    DeviceIngestionAuthGuard,
    DeviceEventDispatcherService,
    DeviceMqttIngestionService,
  ],
  exports: [DeviceIngestionService],
})
export class DeviceIngestionModule {}
