import { Global, Module } from '@nestjs/common';
import { PresenceRealtimeService } from './presence-realtime.service';

@Global()
@Module({
  providers: [PresenceRealtimeService],
  exports: [PresenceRealtimeService],
})
export class PresenceRealtimeModule {}
