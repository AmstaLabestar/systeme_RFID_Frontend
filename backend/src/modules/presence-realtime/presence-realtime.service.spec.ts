import { firstValueFrom, take, timeout } from 'rxjs';
import { PresenceRealtimeService } from './presence-realtime.service';

describe('PresenceRealtimeService', () => {
  it('streams only events belonging to requested owner', async () => {
    const service = new PresenceRealtimeService();
    const ownerStream = service.streamForOwner('owner-1');

    const pending = firstValueFrom(ownerStream.pipe(take(1), timeout({ first: 1000 })));

    service.publishScan({
      ownerId: 'owner-2',
      historyEventId: 'history-2',
      deviceId: 'device-2',
      deviceName: 'Gate',
      employeeName: 'Other User',
      identifierCode: 'BADGE-2',
      attributed: true,
      occurredAt: '2026-03-05T12:00:00.000Z',
    });

    service.publishScan({
      ownerId: 'owner-1',
      historyEventId: 'history-1',
      deviceId: 'device-1',
      deviceName: 'Accueil',
      employeeName: 'Ada Lovelace',
      identifierCode: 'BADGE-1',
      attributed: true,
      occurredAt: '2026-03-05T12:00:01.000Z',
    });

    const event = await pending;

    expect(event.type).toBe('presence.scan');
    expect((event.data as any).historyEventId).toBe('history-1');
    expect((event.data as any).employeeName).toBe('Ada Lovelace');
  });
});
