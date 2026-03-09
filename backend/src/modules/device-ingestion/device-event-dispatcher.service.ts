import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HardwareSystemCode,
  Prisma,
  ServiceHistoryEventType,
} from '@prisma/client';
import { sanitizeString } from '../../common/utils/security.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { PresenceRealtimeService, type PresenceRealtimeScanInput } from '../presence-realtime/presence-realtime.service';

type InboxEventRecord = Prisma.DeviceEventInboxGetPayload<{
  include: {
    eventStore: true;
    device: {
      include: {
        system: {
          select: {
            name: true;
          };
        };
      };
    };
  };
}>;

interface DispatchSingleEventResult {
  processed: boolean;
  scanEvent?: PresenceRealtimeScanInput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeEventType(value: string): string {
  return sanitizeString(value).toLowerCase();
}

function normalizeIdentifierCode(value: string): string {
  return sanitizeString(value).replace(/\s+/g, '').toUpperCase();
}

function extractBadgeCodeFromPayload(payload: Prisma.JsonValue): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidates = [
    payload.badgeCode,
    payload.badge_code,
    payload.identifierCode,
    payload.identifier_code,
    payload.identifier,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return normalizeIdentifierCode(candidate);
    }
  }

  return null;
}

@Injectable()
export class DeviceEventDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceEventDispatcherService.name);
  private readonly dispatchIntervalMs: number;
  private readonly batchSize: number;
  private timer: NodeJS.Timeout | null = null;
  private dispatchInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly presenceRealtimeService: PresenceRealtimeService,
  ) {
    this.dispatchIntervalMs = Number(this.configService.get('DEVICE_EVENT_DISPATCH_INTERVAL_MS') ?? 3000);
    this.batchSize = Number(this.configService.get('DEVICE_EVENT_DISPATCH_BATCH_SIZE') ?? 50);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchPendingEvents();
    }, this.dispatchIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async dispatchPendingEvents(): Promise<void> {
    if (this.dispatchInProgress) {
      return;
    }

    this.dispatchInProgress = true;

    try {
      const pendingEvents = await this.prisma.deviceEventInbox.findMany({
        where: {
          processedAt: null,
        },
        orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
        take: this.batchSize,
        select: {
          id: true,
        },
      });

      for (const event of pendingEvents) {
        try {
          const processed = await this.dispatchSingleEvent(event.id);
          if (processed) {
            this.metricsService.recordDeviceDispatchProcessed();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error';
          this.logger.error(`Device event dispatch failed for ${event.id}: ${message}`);
          this.metricsService.recordDeviceDispatchFailure();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Device event dispatch loop failed: ${message}`);
      this.metricsService.recordDeviceDispatchFailure();
    } finally {
      this.dispatchInProgress = false;
    }
  }

  private async dispatchSingleEvent(inboxId: string): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx): Promise<DispatchSingleEventResult> => {
      const inboxEvent = await tx.deviceEventInbox.findFirst({
        where: {
          id: inboxId,
          processedAt: null,
        },
        include: {
          eventStore: true,
          device: {
            include: {
              system: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!inboxEvent) {
        return { processed: false };
      }

      const scanEvent = await this.routeEvent(tx, inboxEvent);

      const marked = await tx.deviceEventInbox.updateMany({
        where: {
          id: inboxEvent.id,
          processedAt: null,
        },
        data: {
          processedAt: new Date(),
        },
      });

      return {
        processed: marked.count > 0,
        scanEvent,
      };
    });

    if (result.processed && result.scanEvent) {
      this.presenceRealtimeService.publishScan(result.scanEvent);
    }

    return result.processed;
  }

  private async routeEvent(
    tx: Prisma.TransactionClient,
    inboxEvent: InboxEventRecord,
  ): Promise<PresenceRealtimeScanInput | undefined> {
    if (inboxEvent.systemCode === HardwareSystemCode.RFID_PRESENCE) {
      return this.routeRfidPresenceEvent(tx, inboxEvent);
    }

    return undefined;
  }

  private async routeRfidPresenceEvent(
    tx: Prisma.TransactionClient,
    inboxEvent: InboxEventRecord,
  ): Promise<PresenceRealtimeScanInput | undefined> {
    const normalizedEventType = normalizeEventType(inboxEvent.eventType);
    if (normalizedEventType !== 'badge.scanned') {
      return undefined;
    }

    if (!inboxEvent.eventStore) {
      this.logger.warn(`Inbox ${inboxEvent.id} has no linked event store row.`);
      return undefined;
    }

    const badgeCode = extractBadgeCodeFromPayload(inboxEvent.eventStore.payload);
    if (!badgeCode) {
      this.logger.warn(`Inbox ${inboxEvent.id} badge.scanned payload is missing badgeCode.`);
      return undefined;
    }

    const assignment = await tx.serviceAssignment.findFirst({
      where: {
        ownerId: inboxEvent.ownerId,
        module: HardwareSystemCode.RFID_PRESENCE,
        deviceId: inboxEvent.deviceId,
        identifier: {
          physicalIdentifier: {
            equals: badgeCode,
            mode: 'insensitive',
          },
        },
      },
      include: {
        employee: true,
        identifier: true,
        device: {
          include: {
            system: true,
          },
        },
      },
    });

    const employeeName = assignment
      ? `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim()
      : 'Badge non attribue';
    const identifierCode = assignment?.identifier.physicalIdentifier ?? badgeCode;
    const deviceName =
      assignment?.device.configuredName ??
      assignment?.device.system.name ??
      inboxEvent.device.configuredName ??
      inboxEvent.device.system.name;

    const historyEvent = await tx.serviceHistoryEvent.create({
      data: {
        ownerId: inboxEvent.ownerId,
        actorId: null,
        module: HardwareSystemCode.RFID_PRESENCE,
        deviceId: inboxEvent.deviceId,
        identifierId: assignment?.identifierId ?? null,
        employeeId: assignment?.employeeId ?? null,
        employeeName,
        identifierCode,
        deviceName,
        eventType: ServiceHistoryEventType.IDENTIFIER_SCANNED,
        action: assignment ? 'Badge scanne presence' : 'Badge scanne non attribue',
        metadata: {
          ingestionInboxId: inboxEvent.id,
          ingestionEventId: inboxEvent.eventId,
          ingestedEventType: inboxEvent.eventType,
          sourceSequence: inboxEvent.eventStore.sourceSequence
            ? String(inboxEvent.eventStore.sourceSequence)
            : null,
          assignmentId: assignment?.id ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ownerId: inboxEvent.ownerId,
      historyEventId: historyEvent.id,
      deviceId: inboxEvent.deviceId,
      deviceName,
      employeeName,
      identifierCode,
      attributed: assignment?.employeeId != null,
      occurredAt: historyEvent.occurredAt.toISOString(),
      ingestionEventId: inboxEvent.eventId,
      ingestionInboxId: inboxEvent.id,
    };
  }
}
