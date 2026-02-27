import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutboxEventStatus,
  OutboxEventType,
  Prisma,
  type OutboxEvent,
  type WebhookEndpoint,
} from '@prisma/client';
import { createHmac } from 'crypto';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import { decryptSecret, encryptSecret, hashToken } from '../../common/utils/security.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface EnqueueOutboxEventInput {
  eventType: OutboxEventType;
  aggregateType: string;
  aggregateId: string;
  tenantId?: string | null;
  systemId?: string | null;
  orderId?: string | null;
  deviceId?: string | null;
  payload: Prisma.InputJsonValue;
  availableAt?: Date;
}

const WEBHOOK_ENDPOINT_PUBLIC_SELECT = Prisma.validator<Prisma.WebhookEndpointSelect>()({
  id: true,
  name: true,
  url: true,
  events: true,
  isActive: true,
  tenantId: true,
  failureCount: true,
  lastDeliveredAt: true,
  createdAt: true,
  updatedAt: true,
});

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map((segment) => Number.parseInt(segment, 10));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a >= 224) {
    return true;
  }

  return false;
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === '::' || normalized === '::1') {
    return true;
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  if (normalized.startsWith('fe80:')) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIpAddress(normalized.replace('::ffff:', ''));
  }

  return false;
}

function isBlockedIpAddress(address: string): boolean {
  const normalized = address.trim().replace(/^\[|\]$/g, '');
  const version = isIP(normalized);

  if (version === 4) {
    return isBlockedIpv4(normalized);
  }
  if (version === 6) {
    return isBlockedIpv6(normalized);
  }

  return true;
}

async function assertWebhookUrlAllowed(rawUrl: string, nodeEnv: string): Promise<void> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new BadRequestException('URL webhook invalide.');
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase();
  const isLocal = isLocalHostname(hostname);
  const allowLocalHttp = nodeEnv !== 'production' && isLocal;

  if (parsedUrl.username || parsedUrl.password) {
    throw new BadRequestException('URL webhook non autorisee (credentials interdites).');
  }

  if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && allowLocalHttp)) {
    throw new BadRequestException(
      'URL webhook non autorisee. Utilisez HTTPS (HTTP localhost autorise hors production).',
    );
  }

  if (isLocal) {
    if (nodeEnv === 'production') {
      throw new BadRequestException('Les cibles locales sont interdites en production.');
    }
    return;
  }

  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new BadRequestException('URL webhook non autorisee (hote prive ou reserve).');
    }
    return;
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.some((record) => isBlockedIpAddress(record.address))) {
      throw new BadRequestException('URL webhook non autorisee (resolution vers IP privee/reservee).');
    }
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Impossible de valider la cible webhook.');
  }
}

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly dispatchIntervalMs: number;
  private readonly maxRetryAttempts: number;
  private readonly webhookTimeoutMs: number;
  private readonly nodeEnv: string;
  private readonly secretsEncryptionKey: string;
  private timer: NodeJS.Timeout | null = null;
  private dispatchInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.dispatchIntervalMs = Number(
      this.configService.get('OUTBOX_DISPATCH_INTERVAL_MS') ?? 15000,
    );
    this.maxRetryAttempts = Number(this.configService.get('OUTBOX_MAX_RETRY_ATTEMPTS') ?? 5);
    this.webhookTimeoutMs = Number(this.configService.get('OUTBOX_WEBHOOK_TIMEOUT_MS') ?? 5000);
    this.nodeEnv = this.configService.get('NODE_ENV') ?? 'development';
    this.secretsEncryptionKey = this.configService.getOrThrow<string>('TWO_FACTOR_ENCRYPTION_KEY');
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchDueEvents();
    }, this.dispatchIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  enqueue(input: EnqueueOutboxEventInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.outboxEvent.create({
      data: {
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        tenantId: input.tenantId ?? null,
        systemId: input.systemId ?? null,
        orderId: input.orderId ?? null,
        deviceId: input.deviceId ?? null,
        payload: input.payload,
        status: OutboxEventStatus.PENDING,
        availableAt: input.availableAt ?? new Date(),
      },
    });
  }

  listWebhookEndpoints(tenantId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: WEBHOOK_ENDPOINT_PUBLIC_SELECT,
    });
  }

  async createWebhookEndpoint(input: {
    name: string;
    url: string;
    events: OutboxEventType[];
    tenantId: string;
    secret?: string;
  }) {
    await assertWebhookUrlAllowed(input.url, this.nodeEnv);

    const encryptedSecret = input.secret
      ? encryptSecret(input.secret, this.secretsEncryptionKey)
      : null;

    return this.prisma.webhookEndpoint.create({
      data: {
        name: input.name,
        url: input.url,
        events: input.events as unknown as Prisma.InputJsonValue,
        tenantId: input.tenantId,
        secretEncrypted: encryptedSecret?.encrypted ?? null,
        secretIv: encryptedSecret?.iv ?? null,
        secretTag: encryptedSecret?.tag ?? null,
        secretHash: encryptedSecret?.hash ?? null,
        isActive: true,
      },
      select: WEBHOOK_ENDPOINT_PUBLIC_SELECT,
    });
  }

  async setWebhookActivation(webhookId: string, tenantId: string, isActive: boolean) {
    const updated = await this.prisma.webhookEndpoint.updateMany({
      where: {
        id: webhookId,
        tenantId,
      },
      data: { isActive },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Webhook introuvable.');
    }

    return this.prisma.webhookEndpoint.findFirst({
      where: {
        id: webhookId,
        tenantId,
      },
      select: WEBHOOK_ENDPOINT_PUBLIC_SELECT,
    });
  }

  async testWebhookDelivery(
    webhookId: string,
    tenantId: string,
    eventType: OutboxEventType = OutboxEventType.ORDER_ALLOCATED,
  ) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        id: webhookId,
        tenantId,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook introuvable.');
    }

    const syntheticEvent = await this.prisma.outboxEvent.create({
      data: {
        eventType,
        status: OutboxEventStatus.PROCESSING,
        aggregateType: 'WEBHOOK_TEST',
        aggregateId: webhookId,
        tenantId: endpoint.tenantId,
        payload: {
          test: true,
          webhookId: endpoint.id,
          webhookName: endpoint.name,
          emittedAt: new Date().toISOString(),
        },
      },
    });

    try {
      await this.deliverToWebhook(endpoint, syntheticEvent);

      await this.prisma.outboxEvent.update({
        where: { id: syntheticEvent.id },
        data: {
          status: OutboxEventStatus.DELIVERED,
          deliveredAt: new Date(),
          lastError: null,
        },
      });

      return {
        success: true,
        webhookId: endpoint.id,
        eventType,
        eventId: syntheticEvent.id,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 4000) : 'Webhook test delivery failed.';

      await this.prisma.outboxEvent.update({
        where: { id: syntheticEvent.id },
        data: {
          status: OutboxEventStatus.FAILED,
          attempts: 1,
          lastError: message,
        },
      });

      throw error;
    }
  }

  async dispatchDueEvents(): Promise<void> {
    if (this.dispatchInProgress) {
      return;
    }

    this.dispatchInProgress = true;
    const now = new Date();

    try {
      const dueEvents = await this.prisma.outboxEvent.findMany({
        where: {
          status: OutboxEventStatus.PENDING,
          availableAt: {
            lte: now,
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
      });

      for (const event of dueEvents) {
        await this.dispatchSingleEvent(event);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Outbox dispatch failure: ${message}`);
    } finally {
      this.dispatchInProgress = false;
    }
  }

  private async dispatchSingleEvent(event: OutboxEvent): Promise<void> {
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: OutboxEventStatus.PENDING,
      },
      data: {
        status: OutboxEventStatus.PROCESSING,
      },
    });

    if (claimed.count === 0) {
      return;
    }

    try {
      const endpoints = await this.getMatchingWebhookEndpoints(event.eventType, event.tenantId);
      if (endpoints.length > 0) {
        await Promise.all(endpoints.map((endpoint) => this.deliverToWebhook(endpoint, event)));
      }

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxEventStatus.DELIVERED,
          deliveredAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const attempts = event.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 4000) : 'Webhook delivery failed.';
      const shouldFail = attempts >= this.maxRetryAttempts;
      const retryDelaySeconds = Math.min(300, attempts * attempts * 10);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: shouldFail ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
          attempts,
          availableAt: shouldFail
            ? event.availableAt
            : new Date(Date.now() + retryDelaySeconds * 1000),
          lastError: message,
        },
      });
    }
  }

  private async getMatchingWebhookEndpoints(
    eventType: OutboxEventType,
    tenantId: string | null,
  ): Promise<WebhookEndpoint[]> {
    if (!tenantId) {
      return [];
    }

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        tenantId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return endpoints.filter((endpoint) => {
      const eventList = Array.isArray(endpoint.events)
        ? endpoint.events.map((entry) => String(entry))
        : [];
      return eventList.includes(eventType) || eventList.includes('*');
    });
  }

  private async deliverToWebhook(endpoint: WebhookEndpoint, event: OutboxEvent): Promise<void> {
    // Re-validate URL on each delivery to reduce SSRF/DNS-rebinding exposure.
    await assertWebhookUrlAllowed(endpoint.url, this.nodeEnv);

    const payload = {
      id: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      systemId: event.systemId,
      orderId: event.orderId,
      deviceId: event.deviceId,
      createdAt: event.createdAt,
      payload: event.payload,
    };

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-rfid-event-id': event.id,
      'x-rfid-event-type': event.eventType,
    };

    if (endpoint.secretEncrypted && endpoint.secretIv && endpoint.secretTag) {
      const decryptedSecret = decryptSecret(
        {
          encrypted: endpoint.secretEncrypted,
          iv: endpoint.secretIv,
          tag: endpoint.secretTag,
        },
        this.secretsEncryptionKey,
      );

      if (endpoint.secretHash && hashToken(decryptedSecret) !== endpoint.secretHash) {
        throw new Error(`Webhook ${endpoint.id} secret integrity check failed.`);
      }

      headers['x-rfid-signature'] = createHmac('sha256', decryptedSecret).update(body).digest('hex');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.webhookTimeoutMs);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        redirect: 'error',
      });

      if (!response.ok) {
        throw new Error(`Webhook ${endpoint.id} failed with status ${response.status}`);
      }

      await this.prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          failureCount: 0,
          lastDeliveredAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          failureCount: {
            increment: 1,
          },
        },
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
