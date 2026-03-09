import { Injectable, type MessageEvent } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

export interface PresenceRealtimeScanInput {
  ownerId: string;
  historyEventId: string;
  deviceId: string;
  deviceName: string;
  employeeName: string;
  identifierCode: string;
  attributed: boolean;
  occurredAt: string;
  ingestionEventId?: string;
  ingestionInboxId?: string;
}

interface PresenceRealtimeScanInternal extends PresenceRealtimeScanInput {
  streamEventId: string;
}

export interface PresenceRealtimeScanMessage {
  id: string;
  historyEventId: string;
  deviceId: string;
  deviceName: string;
  employeeName: string;
  identifierCode: string;
  attributed: boolean;
  occurredAt: string;
  ingestionEventId?: string;
  ingestionInboxId?: string;
}

@Injectable()
export class PresenceRealtimeService {
  private readonly scansSubject = new Subject<PresenceRealtimeScanInternal>();

  publishScan(event: PresenceRealtimeScanInput): void {
    this.scansSubject.next({
      ...event,
      streamEventId: randomUUID(),
    });
  }

  streamForOwner(ownerId: string): Observable<MessageEvent> {
    const scans$ = this.scansSubject.pipe(
      filter((event) => event.ownerId === ownerId),
      map((event) => ({
        id: event.streamEventId,
        type: 'presence.scan',
        data: {
          id: event.streamEventId,
          historyEventId: event.historyEventId,
          deviceId: event.deviceId,
          deviceName: event.deviceName,
          employeeName: event.employeeName,
          identifierCode: event.identifierCode,
          attributed: event.attributed,
          occurredAt: event.occurredAt,
          ingestionEventId: event.ingestionEventId,
          ingestionInboxId: event.ingestionInboxId,
        } satisfies PresenceRealtimeScanMessage,
      } as MessageEvent)),
    );

    const heartbeat$ = interval(30_000).pipe(
      map(
        () =>
          ({
            type: 'presence.heartbeat',
            data: {
              emittedAt: new Date().toISOString(),
            },
          }) as MessageEvent,
      ),
    );

    return merge(scans$, heartbeat$);
  }
}
