import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutboxEventStatus,
  OutboxEventType,
  Prisma,
  type OutboxEvent,
  type WebhookEndpoint,
} from '@prisma/client';
import { createHmac } from 'crypto';
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

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly dispatchIntervalMs: number;
  private readonly maxRetryAttempts: number;
  private readonly webhookTimeoutMs: number;
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

  listWebhookEndpoints() {
    return this.prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  createWebhookEndpoint(input: {
    name: string;
    url: string;
    events: OutboxEventType[];
    tenantId?: string;
    secret?: string;
  }) {
    return this.prisma.webhookEndpoint.create({
      data: {
        name: input.name,
        url: input.url,
        events: input.events as unknown as Prisma.InputJsonValue,
        tenantId: input.tenantId ?? null,
        secret: input.secret ?? null,
        isActive: true,
      },
    });
  }

  setWebhookActivation(webhookId: string, isActive: boolean) {
    return this.prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data: { isActive },
    });
  }

  async testWebhookDelivery(
    webhookId: string,
    eventType: OutboxEventType = OutboxEventType.ORDER_ALLOCATED,
  ) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: webhookId },
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
        await Promise.all(
          endpoints.map((endpoint) => this.deliverToWebhook(endpoint, event)),
        );
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
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        OR: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
      },
      orderBy: { createdAt: 'asc' },
    });

    return endpoints.filter((endpoint) => {
      const eventList = Array.isArray(endpoint.events) ? endpoint.events : [];
      return eventList.includes(eventType) || eventList.includes('*');
    });
  }

  private async deliverToWebhook(endpoint: WebhookEndpoint, event: OutboxEvent): Promise<void> {
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

    if (endpoint.secret) {
      headers['x-rfid-signature'] = createHmac('sha256', endpoint.secret).update(body).digest('hex');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.webhookTimeoutMs);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
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
