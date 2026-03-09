import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { hashToken } from '../../common/utils/security.util';
import { MetricsService } from '../observability/metrics.service';
import type { DeviceAuthContext } from './device-ingestion.types';
import { IngestDeviceEventDto } from './dto/ingest-device-event.dto';

function normalizeMacAddress(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

@Injectable()
export class DeviceIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async rotateIngestionKey(ownerId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        ownerId,
        status: DeviceStatus.ASSIGNED,
      },
      include: {
        system: {
          select: {
            code: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Boitier introuvable ou non attribue.');
    }

    if (!device.isConfigured) {
      throw new BadRequestException('Configurez ce boitier avant de generer une cle ingestion.');
    }

    const rawKey = `dik_${randomBytes(32).toString('hex')}`;
    const keyHash = hashToken(rawKey);
    const now = new Date();

    await this.prisma.deviceIngestionKey.upsert({
      where: {
        deviceId: device.id,
      },
      create: {
        deviceId: device.id,
        keyHash,
        createdById: ownerId,
        lastUsedAt: null,
        revokedAt: null,
      },
      update: {
        keyHash,
        createdById: ownerId,
        lastUsedAt: null,
        revokedAt: null,
      },
    });

    return {
      deviceId: device.id,
      systemCode: device.system.code,
      key: rawKey,
      rotatedAt: now.toISOString(),
    };
  }

  async resolveDeviceAuthContext(rawKey: string): Promise<DeviceAuthContext> {
    const normalizedKey = rawKey.trim();
    if (normalizedKey.length < 24 || normalizedKey.length > 256) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Cle boitier invalide.');
    }

    const keyHash = hashToken(normalizedKey);
    const ingestionKey = await this.prisma.deviceIngestionKey.findUnique({
      where: { keyHash },
      include: {
        device: {
          include: {
            system: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!ingestionKey || ingestionKey.revokedAt) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Cle boitier invalide ou revoquee.');
    }

    const ownerId = ingestionKey.device.ownerId;
    if (!ownerId) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Boitier non attribue a un client.');
    }

    if (ingestionKey.device.status !== DeviceStatus.ASSIGNED) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Boitier non autorise pour l ingestion.');
    }

    if (!ingestionKey.device.isConfigured) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new BadRequestException('Boitier non configure.');
    }

    return {
      keyId: ingestionKey.id,
      ownerId,
      ownerTenantId: ingestionKey.device.ownerTenantId ?? undefined,
      deviceId: ingestionKey.device.id,
      systemCode: ingestionKey.device.system.code,
      macAddress: ingestionKey.device.macAddress,
    };
  }

  async ingestEvent(context: DeviceAuthContext, dto: IngestDeviceEventDto) {
    let occurredAt: Date;
    let sentAt: Date | null;
    let receivedAt: Date;

    try {
      this.validateSourceIntegrity(context, dto);

      occurredAt = new Date(dto.occurredAt);
      sentAt = dto.sentAt ? new Date(dto.sentAt) : null;
      receivedAt = new Date();

      if (Number.isNaN(occurredAt.getTime()) || (sentAt && Number.isNaN(sentAt.getTime()))) {
        throw new BadRequestException('Horodatage evenement invalide.');
      }
    } catch (error) {
      this.metricsService.recordDeviceIngestionRejected();
      throw error;
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const inbox = await tx.deviceEventInbox.create({
          data: {
            ownerId: context.ownerId,
            deviceId: context.deviceId,
            ingestionKeyId: context.keyId,
            systemCode: context.systemCode,
            eventId: dto.eventId,
            eventType: dto.eventType,
            schemaVersion: dto.schemaVersion,
            occurredAt,
            sentAt,
            receivedAt,
          },
          select: {
            id: true,
            receivedAt: true,
          },
        });

        await tx.deviceEventStore.create({
          data: {
            inboxId: inbox.id,
            ownerId: context.ownerId,
            deviceId: context.deviceId,
            systemCode: context.systemCode,
            eventType: dto.eventType,
            schemaVersion: dto.schemaVersion,
            sourceDeviceMac: dto.source.deviceMac ?? context.macAddress,
            sourceSequence:
              typeof dto.source.sequence === 'number' ? BigInt(dto.source.sequence) : null,
            occurredAt,
            sentAt,
            receivedAt: inbox.receivedAt,
            payload: dto.payload as Prisma.InputJsonValue,
            rawEvent: dto as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.deviceIngestionKey.update({
          where: { id: context.keyId },
          data: {
            lastUsedAt: inbox.receivedAt,
          },
        });

        return inbox;
      });

      this.metricsService.recordDeviceIngestionAccepted();

      return {
        status: 'accepted' as const,
        eventId: dto.eventId,
        inboxId: result.id,
        receivedAt: result.receivedAt.toISOString(),
      };
    } catch (error) {
      if (this.isDuplicateInboxError(error)) {
        const duplicate = await this.prisma.deviceEventInbox.findFirst({
          where: {
            ownerId: context.ownerId,
            deviceId: context.deviceId,
            eventId: dto.eventId,
          },
          select: {
            id: true,
            receivedAt: true,
          },
        });

        if (!duplicate) {
          throw new ConflictException('Conflit d idempotence detecte sans evenement cible.');
        }

        await this.prisma.deviceIngestionKey
          .update({
            where: { id: context.keyId },
            data: {
              lastUsedAt: new Date(),
            },
          })
          .catch(() => undefined);

        this.metricsService.recordDeviceIngestionDuplicate();

        return {
          status: 'duplicate_accepted' as const,
          eventId: dto.eventId,
          inboxId: duplicate.id,
          receivedAt: duplicate.receivedAt.toISOString(),
        };
      }

      this.metricsService.recordDeviceIngestionRejected();
      throw error;
    }
  }

  private validateSourceIntegrity(context: DeviceAuthContext, dto: IngestDeviceEventDto): void {
    if (dto.source.deviceId !== context.deviceId) {
      throw new BadRequestException('source.deviceId ne correspond pas a la cle boitier.');
    }

    if (dto.source.systemCode !== context.systemCode) {
      throw new BadRequestException('source.systemCode ne correspond pas au boitier.');
    }

    if (dto.source.deviceMac) {
      const providedMac = normalizeMacAddress(dto.source.deviceMac);
      const expectedMac = normalizeMacAddress(context.macAddress);
      if (providedMac !== expectedMac) {
        throw new BadRequestException('source.deviceMac ne correspond pas au boitier.');
      }
    }
  }

  private isDuplicateInboxError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const prismaError = error as {
      code?: string;
      meta?: {
        target?: unknown;
      };
    };

    if (prismaError.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(prismaError.meta?.target)
      ? (prismaError.meta?.target as string[])
      : [String(prismaError.meta?.target ?? '')];

    const normalizedTarget = target.join('|');
    return (
      normalizedTarget.includes('ownerId') &&
      normalizedTarget.includes('deviceId') &&
      normalizedTarget.includes('eventId')
    );
  }
}
