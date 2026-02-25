import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AllocationStatus,
  DeviceStatus,
  HardwareSystemCode,
  IdentifierStatus,
  OrderStatus,
  OrderTargetType,
  OutboxEventType,
  Prisma,
  type Device,
  type Identifier,
  type Order,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { OrdersService } from '../orders/orders.service';
import { BusinessSystemsService } from '../systems/business-systems.service';

interface QrCodeModule {
  toDataURL(content: string): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrCode = require('qrcode') as QrCodeModule;

export interface AllocateOrderInput {
  customerId: string;
  systemCode: HardwareSystemCode;
  targetType: OrderTargetType;
  quantity: number;
  idempotencyKey?: string;
}

export interface AllocationResult {
  order: Order;
  allocatedDevices: Device[];
  allocatedIdentifiers: Identifier[];
}

interface LockedDeviceRow {
  id: string;
  warehouseCode: string;
}

interface LockedIdentifierRow {
  id: string;
  warehouseCode: string;
  deviceId: string | null;
}

@Injectable()
export class AllocationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AllocationsService.name);
  private readonly idempotencyKeyRegex = /^[A-Za-z0-9:_-]{8,120}$/;
  private readonly reservationTtlMs: number;
  private readonly reservationCleanupIntervalMs: number;
  private reservationCleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly ordersService: OrdersService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly outboxService: OutboxService,
  ) {
    this.reservationTtlMs = Number(
      this.configService.get('ALLOCATION_RESERVATION_TTL_MS') ?? 300000,
    );
    this.reservationCleanupIntervalMs = Number(
      this.configService.get('ALLOCATION_RESERVATION_CLEANUP_INTERVAL_MS') ?? 60000,
    );
  }

  onModuleInit(): void {
    this.reservationCleanupTimer = setInterval(() => {
      void this.releaseExpiredReservations();
    }, this.reservationCleanupIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.reservationCleanupTimer) {
      clearInterval(this.reservationCleanupTimer);
      this.reservationCleanupTimer = null;
    }
  }

  async allocateOrder(input: AllocateOrderInput) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity doit etre un entier strictement positif.');
    }

    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const existingResult = idempotencyKey
      ? await this.getExistingIdempotentOrderResult(input.customerId, idempotencyKey)
      : null;
    if (existingResult) {
      return existingResult;
    }

    const system = await this.businessSystemsService.getSystemByCodeOrThrow(input.systemCode, true);
    const supportsIdentifiers = this.supportsIdentifiers(system);

    if (input.targetType === OrderTargetType.IDENTIFIER_EXTENSION && !supportsIdentifiers) {
      throw new BadRequestException(
        'Ce systeme ne supporte pas l achat d extensions d identifiants.',
      );
    }

    if (
      input.targetType === OrderTargetType.IDENTIFIER_EXTENSION &&
      supportsIdentifiers &&
      !system.identifierType
    ) {
      throw new BadRequestException(
        'Le type d identifiant de ce systeme est manquant. Contactez un administrateur.',
      );
    }

    try {
      const result = await this.prisma.$transaction<AllocationResult>(
        async (tx) => {
          const customer = await tx.user.findUnique({
            where: { id: input.customerId },
            select: {
              id: true,
              tenantId: true,
            },
          });

          if (!customer) {
            throw new NotFoundException('Client introuvable.');
          }

          const unitPriceCents =
            input.targetType === OrderTargetType.DEVICE
              ? system.deviceUnitPriceCents
              : supportsIdentifiers
                ? system.extensionUnitPriceCents
                : 0;

          const order = await this.ordersService.createOrder(
            {
              customerId: customer.id,
              tenantId: customer.tenantId,
              systemId: system.id,
              targetType: input.targetType,
              quantity: input.quantity,
              idempotencyKey,
              unitPriceCents,
              currency: system.currency,
            },
            tx,
          );

          const allocatedDeviceIds: string[] = [];
          const allocatedIdentifierIds: string[] = [];
          const ledgerEntries: Parameters<StockLedgerService['append']>[0] = [];

          if (input.targetType === OrderTargetType.DEVICE) {
            // Business invariant: purchase never creates hardware, it only allocates pre-provisioned stock.
            const lockedDevices = await this.lockDeviceRows(tx, system.id, input.quantity);
            if (lockedDevices.length < input.quantity) {
              throw new BadRequestException('Stock de boitiers insuffisant pour cet achat.');
            }

            await this.reserveDevices(tx, lockedDevices);
            ledgerEntries.push(
              ...lockedDevices.map((device) => ({
                resourceType: 'DEVICE' as const,
                resourceId: device.id,
                systemId: system.id,
                deviceId: device.id,
                orderId: order.id,
                action: 'RESERVED' as const,
                warehouseCode: device.warehouseCode,
                ownerId: customer.id,
                fromStatus: DeviceStatus.IN_STOCK,
                toStatus: DeviceStatus.RESERVED,
              })),
            );

            for (const lockedDevice of lockedDevices) {
              let qrCodeToken: string | undefined;
              let qrCodeDataUrl: string | undefined;

              if (system.code === HardwareSystemCode.FEEDBACK) {
                const qrPayload = await this.generateFeedbackQrCodePayload(tx);
                qrCodeToken = qrPayload.token;
                qrCodeDataUrl = qrPayload.dataUrl;
              }

              await tx.device.update({
                where: { id: lockedDevice.id },
                data: {
                  status: DeviceStatus.ASSIGNED,
                  ownerId: customer.id,
                  ownerTenantId: customer.tenantId,
                  assignedAt: new Date(),
                  reservedAt: null,
                  reservationExpiresAt: null,
                  qrCodeToken,
                  qrCodeDataUrl,
                },
              });
              allocatedDeviceIds.push(lockedDevice.id);

              ledgerEntries.push({
                resourceType: 'DEVICE',
                resourceId: lockedDevice.id,
                systemId: system.id,
                deviceId: lockedDevice.id,
                orderId: order.id,
                action: 'ASSIGNED',
                warehouseCode: lockedDevice.warehouseCode,
                ownerId: customer.id,
                fromStatus: DeviceStatus.RESERVED,
                toStatus: DeviceStatus.ASSIGNED,
              });

              if (supportsIdentifiers && system.identifiersPerDevice > 0) {
                const bundledIdentifiers = await this.lockBundledIdentifierRows(
                  tx,
                  lockedDevice.id,
                  system.identifiersPerDevice,
                );

                if (bundledIdentifiers.length < system.identifiersPerDevice) {
                  throw new ConflictException(
                    `Boitier ${lockedDevice.id} sans lot complet d identifiants en stock.`,
                  );
                }

                await this.reserveIdentifiers(tx, bundledIdentifiers);
                ledgerEntries.push(
                  ...bundledIdentifiers.map((identifier) => ({
                    resourceType: 'IDENTIFIER' as const,
                    resourceId: identifier.id,
                    systemId: system.id,
                    deviceId: lockedDevice.id,
                    identifierId: identifier.id,
                    orderId: order.id,
                    action: 'RESERVED' as const,
                    warehouseCode: identifier.warehouseCode,
                    ownerId: customer.id,
                    fromStatus: IdentifierStatus.IN_STOCK,
                    toStatus: IdentifierStatus.RESERVED,
                  })),
                );

                await this.assignIdentifiers(tx, bundledIdentifiers, customer.id, customer.tenantId);
                allocatedIdentifierIds.push(...bundledIdentifiers.map((identifier) => identifier.id));

                ledgerEntries.push(
                  ...bundledIdentifiers.map((identifier) => ({
                    resourceType: 'IDENTIFIER' as const,
                    resourceId: identifier.id,
                    systemId: system.id,
                    deviceId: lockedDevice.id,
                    identifierId: identifier.id,
                    orderId: order.id,
                    action: 'ASSIGNED' as const,
                    warehouseCode: identifier.warehouseCode,
                    ownerId: customer.id,
                    fromStatus: IdentifierStatus.RESERVED,
                    toStatus: IdentifierStatus.ASSIGNED,
                  })),
                );
              }
            }
          } else {
            const extensionIdentifiers = await this.lockStandaloneIdentifierRows(
              tx,
              system.id,
              system.identifierType!,
              input.quantity,
            );

            if (extensionIdentifiers.length < input.quantity) {
              throw new BadRequestException('Stock d extensions insuffisant pour cet achat.');
            }

            await this.reserveIdentifiers(tx, extensionIdentifiers);
            ledgerEntries.push(
              ...extensionIdentifiers.map((identifier) => ({
                resourceType: 'IDENTIFIER' as const,
                resourceId: identifier.id,
                systemId: system.id,
                identifierId: identifier.id,
                orderId: order.id,
                action: 'RESERVED' as const,
                warehouseCode: identifier.warehouseCode,
                ownerId: customer.id,
                fromStatus: IdentifierStatus.IN_STOCK,
                toStatus: IdentifierStatus.RESERVED,
              })),
            );

            await this.assignIdentifiers(tx, extensionIdentifiers, customer.id, customer.tenantId);
            allocatedIdentifierIds.push(...extensionIdentifiers.map((identifier) => identifier.id));

            ledgerEntries.push(
              ...extensionIdentifiers.map((identifier) => ({
                resourceType: 'IDENTIFIER' as const,
                resourceId: identifier.id,
                systemId: system.id,
                identifierId: identifier.id,
                orderId: order.id,
                action: 'ASSIGNED' as const,
                warehouseCode: identifier.warehouseCode,
                ownerId: customer.id,
                fromStatus: IdentifierStatus.RESERVED,
                toStatus: IdentifierStatus.ASSIGNED,
              })),
            );
          }

          await tx.allocation.createMany({
            data: [
              ...allocatedDeviceIds.map((deviceId) => ({
                orderId: order.id,
                customerId: customer.id,
                deviceId,
                status: AllocationStatus.ASSIGNED,
              })),
              ...allocatedIdentifierIds.map((identifierId) => ({
                orderId: order.id,
                customerId: customer.id,
                identifierId,
                status: AllocationStatus.ASSIGNED,
              })),
            ],
          });

          await this.stockLedgerService.append(ledgerEntries, tx);
          await this.ordersService.markCompleted(order.id, tx);
          await this.outboxService.enqueue(
            {
              eventType: OutboxEventType.ORDER_ALLOCATED,
              aggregateType: 'ORDER',
              aggregateId: order.id,
              tenantId: customer.tenantId,
              systemId: system.id,
              orderId: order.id,
              payload: {
                orderId: order.id,
                customerId: customer.id,
                targetType: input.targetType,
                quantity: input.quantity,
                allocatedDevices: allocatedDeviceIds,
                allocatedIdentifiers: allocatedIdentifierIds,
              },
            },
            tx,
          );

          await this.emitLowStockEventIfNeeded(tx, system.id, customer.tenantId);

          const [finalOrder, allocatedDevices, allocatedIdentifiers] = await Promise.all([
            this.ordersService.findOrderById(order.id, tx),
            allocatedDeviceIds.length > 0
              ? tx.device.findMany({
                  where: { id: { in: allocatedDeviceIds } },
                  orderBy: { createdAt: 'asc' },
                  include: {
                    system: true,
                    identifiers: {
                      where: {
                        ownerId: customer.id,
                      },
                      orderBy: { createdAt: 'asc' },
                    },
                  },
                })
              : Promise.resolve([]),
            allocatedIdentifierIds.length > 0
              ? tx.identifier.findMany({
                  where: { id: { in: allocatedIdentifierIds } },
                  orderBy: { createdAt: 'asc' },
                  include: {
                    system: true,
                  },
                })
              : Promise.resolve([]),
          ]);

          if (!finalOrder) {
            throw new NotFoundException('Commande introuvable apres allocation.');
          }

          return {
            order: finalOrder,
            allocatedDevices,
            allocatedIdentifiers,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return {
        order: result.order,
        allocatedDevices: result.allocatedDevices,
        allocatedIdentifiers: result.allocatedIdentifiers,
      };
    } catch (error) {
      if (idempotencyKey && this.isIdempotencyConflictError(error)) {
        const retriedResult = await this.getExistingIdempotentOrderResult(
          input.customerId,
          idempotencyKey,
        );
        if (retriedResult) {
          return retriedResult;
        }
      }
      throw error;
    }
  }

  async releaseExpiredReservations(): Promise<{
    releasedDevices: number;
    releasedIdentifiers: number;
  }> {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const [expiredDevices, expiredIdentifiers] = await Promise.all([
        tx.device.findMany({
          where: {
            status: DeviceStatus.RESERVED,
            reservationExpiresAt: {
              lte: now,
            },
          },
          select: {
            id: true,
            systemId: true,
            ownerTenantId: true,
            warehouseCode: true,
          },
        }),
        tx.identifier.findMany({
          where: {
            status: IdentifierStatus.RESERVED,
            reservationExpiresAt: {
              lte: now,
            },
          },
          select: {
            id: true,
            systemId: true,
            ownerTenantId: true,
            warehouseCode: true,
            deviceId: true,
          },
        }),
      ]);

      if (expiredDevices.length === 0 && expiredIdentifiers.length === 0) {
        return {
          releasedDevices: 0,
          releasedIdentifiers: 0,
        };
      }

      if (expiredDevices.length > 0) {
        await tx.device.updateMany({
          where: {
            id: { in: expiredDevices.map((device) => device.id) },
            status: DeviceStatus.RESERVED,
          },
          data: {
            status: DeviceStatus.IN_STOCK,
            ownerId: null,
            ownerTenantId: null,
            reservedAt: null,
            reservationExpiresAt: null,
          },
        });
      }

      if (expiredIdentifiers.length > 0) {
        await tx.identifier.updateMany({
          where: {
            id: { in: expiredIdentifiers.map((identifier) => identifier.id) },
            status: IdentifierStatus.RESERVED,
          },
          data: {
            status: IdentifierStatus.IN_STOCK,
            ownerId: null,
            ownerTenantId: null,
            reservedAt: null,
            reservationExpiresAt: null,
          },
        });
      }

      await this.stockLedgerService.append(
        [
          ...expiredDevices.map((device) => ({
            resourceType: 'DEVICE' as const,
            resourceId: device.id,
            systemId: device.systemId,
            deviceId: device.id,
            action: 'RELEASED' as const,
            warehouseCode: device.warehouseCode,
            fromStatus: DeviceStatus.RESERVED,
            toStatus: DeviceStatus.IN_STOCK,
          })),
          ...expiredIdentifiers.map((identifier) => ({
            resourceType: 'IDENTIFIER' as const,
            resourceId: identifier.id,
            systemId: identifier.systemId,
            deviceId: identifier.deviceId,
            identifierId: identifier.id,
            action: 'RELEASED' as const,
            warehouseCode: identifier.warehouseCode,
            fromStatus: IdentifierStatus.RESERVED,
            toStatus: IdentifierStatus.IN_STOCK,
          })),
        ],
        tx,
      );

      const tenantIds = new Set<string>();
      expiredDevices.forEach((device) => {
        if (device.ownerTenantId) {
          tenantIds.add(device.ownerTenantId);
        }
      });
      expiredIdentifiers.forEach((identifier) => {
        if (identifier.ownerTenantId) {
          tenantIds.add(identifier.ownerTenantId);
        }
      });

      await Promise.all(
        Array.from(tenantIds).map((tenantId) =>
          this.outboxService.enqueue(
            {
              eventType: OutboxEventType.RESERVATION_RELEASED,
              aggregateType: 'RESERVATION',
              aggregateId: `${tenantId}:${now.getTime()}`,
              tenantId,
              payload: {
                releasedDevices: expiredDevices.length,
                releasedIdentifiers: expiredIdentifiers.length,
              },
            },
            tx,
          ),
        ),
      );

      const touchedSystemIds = new Set<string>([
        ...expiredDevices.map((device) => device.systemId),
        ...expiredIdentifiers.map((identifier) => identifier.systemId),
      ]);

      await Promise.all(
        Array.from(touchedSystemIds).map((systemId) =>
          this.emitLowStockEventIfNeeded(tx, systemId),
        ),
      );

      return {
        releasedDevices: expiredDevices.length,
        releasedIdentifiers: expiredIdentifiers.length,
      };
    });

    if (result.releasedDevices > 0 || result.releasedIdentifiers > 0) {
      this.logger.warn(
        `Reservations expirees liberees: devices=${result.releasedDevices}, identifiers=${result.releasedIdentifiers}`,
      );
    }

    return result;
  }

  private async lockDeviceRows(
    tx: Prisma.TransactionClient,
    systemId: string,
    quantity: number,
  ): Promise<LockedDeviceRow[]> {
    const rows = await tx.$queryRaw<Array<{ id: string; warehouseCode: string }>>(Prisma.sql`
      SELECT id, "warehouseCode"
      FROM "devices"
      WHERE "systemId" = ${systemId}
        AND status = CAST(${DeviceStatus.IN_STOCK} AS "DeviceStatus")
        AND "ownerId" IS NULL
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${quantity}
    `);

    return rows.map((row) => ({
      id: row.id,
      warehouseCode: row.warehouseCode ?? 'MAIN',
    }));
  }

  private async lockBundledIdentifierRows(
    tx: Prisma.TransactionClient,
    deviceId: string,
    quantity: number,
  ): Promise<LockedIdentifierRow[]> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; warehouseCode: string; deviceId: string | null }>
    >(Prisma.sql`
      SELECT id, "warehouseCode", "deviceId"
      FROM "identifiers"
      WHERE "deviceId" = ${deviceId}
        AND status = CAST(${IdentifierStatus.IN_STOCK} AS "IdentifierStatus")
        AND "ownerId" IS NULL
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${quantity}
    `);

    return rows.map((row) => ({
      id: row.id,
      warehouseCode: row.warehouseCode ?? 'MAIN',
      deviceId: row.deviceId,
    }));
  }

  private async lockStandaloneIdentifierRows(
    tx: Prisma.TransactionClient,
    systemId: string,
    identifierType: Identifier['type'],
    quantity: number,
  ): Promise<LockedIdentifierRow[]> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; warehouseCode: string; deviceId: string | null }>
    >(Prisma.sql`
      SELECT id, "warehouseCode", "deviceId"
      FROM "identifiers"
      WHERE "systemId" = ${systemId}
        AND "deviceId" IS NULL
        AND status = CAST(${IdentifierStatus.IN_STOCK} AS "IdentifierStatus")
        AND "ownerId" IS NULL
        AND type = CAST(${identifierType} AS "IdentifierType")
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${quantity}
    `);

    return rows.map((row) => ({
      id: row.id,
      warehouseCode: row.warehouseCode ?? 'MAIN',
      deviceId: row.deviceId,
    }));
  }

  private async reserveDevices(
    tx: Prisma.TransactionClient,
    devices: LockedDeviceRow[],
  ): Promise<void> {
    if (devices.length === 0) {
      return;
    }

    const now = new Date();
    const reservationExpiresAt = new Date(now.getTime() + this.reservationTtlMs);
    const deviceIds = devices.map((device) => device.id);

    const reserved = await tx.device.updateMany({
      where: {
        id: { in: deviceIds },
        status: DeviceStatus.IN_STOCK,
        ownerId: null,
      },
      data: {
        status: DeviceStatus.RESERVED,
        reservedAt: now,
        reservationExpiresAt,
      },
    });

    if (reserved.count !== deviceIds.length) {
      throw new ConflictException('Conflit de reservation: boitiers deja modifies.');
    }
  }

  private async reserveIdentifiers(
    tx: Prisma.TransactionClient,
    identifiers: LockedIdentifierRow[],
  ): Promise<void> {
    if (identifiers.length === 0) {
      return;
    }

    const now = new Date();
    const reservationExpiresAt = new Date(now.getTime() + this.reservationTtlMs);
    const identifierIds = identifiers.map((identifier) => identifier.id);

    const reserved = await tx.identifier.updateMany({
      where: {
        id: { in: identifierIds },
        status: IdentifierStatus.IN_STOCK,
        ownerId: null,
      },
      data: {
        status: IdentifierStatus.RESERVED,
        reservedAt: now,
        reservationExpiresAt,
      },
    });

    if (reserved.count !== identifierIds.length) {
      throw new ConflictException('Conflit de reservation: identifiants deja modifies.');
    }
  }

  private async assignIdentifiers(
    tx: Prisma.TransactionClient,
    identifiers: LockedIdentifierRow[],
    customerId: string,
    tenantId: string,
  ): Promise<void> {
    if (identifiers.length === 0) {
      return;
    }

    const identifierIds = identifiers.map((identifier) => identifier.id);

    const assigned = await tx.identifier.updateMany({
      where: {
        id: { in: identifierIds },
        status: IdentifierStatus.RESERVED,
      },
      data: {
        status: IdentifierStatus.ASSIGNED,
        ownerId: customerId,
        ownerTenantId: tenantId,
        reservedAt: null,
        reservationExpiresAt: null,
      },
    });

    if (assigned.count !== identifierIds.length) {
      throw new ConflictException('Conflit d attribution: identifiants partiellement assignes.');
    }
  }

  private async generateFeedbackQrCodePayload(
    tx: Prisma.TransactionClient,
  ): Promise<{ token: string; dataUrl: string }> {
    let token = randomBytes(24).toString('hex');
    let existing = await tx.device.findUnique({
      where: { qrCodeToken: token },
      select: { id: true },
    });

    while (existing) {
      token = randomBytes(24).toString('hex');
      existing = await tx.device.findUnique({
        where: { qrCodeToken: token },
        select: { id: true },
      });
    }

    const dataUrl = await qrCode.toDataURL(`/public/feedback/${token}`);
    return { token, dataUrl };
  }

  private normalizeIdempotencyKey(rawValue?: string): string | undefined {
    if (!rawValue || rawValue.trim().length === 0) {
      return undefined;
    }

    const normalized = rawValue.trim();
    if (!this.idempotencyKeyRegex.test(normalized)) {
      throw new BadRequestException(
        'Idempotency-Key invalide. Format attendu: 8-120 caracteres [A-Za-z0-9:_-].',
      );
    }
    return normalized;
  }

  private async getExistingIdempotentOrderResult(
    customerId: string,
    idempotencyKey: string,
  ): Promise<AllocationResult | null> {
    const existingOrder = await this.ordersService.findByCustomerAndIdempotencyKey(
      customerId,
      idempotencyKey,
    );

    if (!existingOrder) {
      return null;
    }

    if (existingOrder.status === OrderStatus.FAILED) {
      throw new ConflictException(
        `La commande precedente avec cette cle idempotente a echoue: ${
          existingOrder.failureReason ?? 'raison non specifiee'
        }.`,
      );
    }

    if (existingOrder.status !== OrderStatus.COMPLETED) {
      throw new ConflictException('Une commande est deja en cours avec cette cle idempotente.');
    }

    const deviceMap = new Map<string, Device>();
    const identifierMap = new Map<string, Identifier>();

    existingOrder.allocations.forEach((allocation) => {
      if (allocation.device) {
        const filteredDevice = {
          ...allocation.device,
          identifiers: allocation.device.identifiers.filter(
            (identifier) => identifier.ownerId === customerId,
          ),
        } as Device;

        deviceMap.set(allocation.device.id, filteredDevice);
      }

      if (allocation.identifier) {
        identifierMap.set(allocation.identifier.id, allocation.identifier as Identifier);
      }
    });

    return {
      order: existingOrder,
      allocatedDevices: Array.from(deviceMap.values()),
      allocatedIdentifiers: Array.from(identifierMap.values()),
    };
  }

  private isIdempotencyConflictError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target)
      ? (error.meta?.target as string[])
      : [String(error.meta?.target ?? '')];

    return target.some((value) => value.includes('customerId') && value.includes('idempotencyKey'));
  }

  private async emitLowStockEventIfNeeded(
    tx: Prisma.TransactionClient,
    systemId: string,
    tenantId?: string,
  ): Promise<void> {
    const system = await tx.businessSystem.findUnique({
      where: { id: systemId },
      select: {
        id: true,
        code: true,
        name: true,
        hasIdentifiers: true,
        lowStockThreshold: true,
      },
    });

    if (!system) {
      return;
    }
    const supportsIdentifiers = this.supportsIdentifiers(system);

    const [availableDevices, availableExtensions] = await Promise.all([
      tx.device.count({
        where: {
          systemId: system.id,
          status: DeviceStatus.IN_STOCK,
          ownerId: null,
        },
      }),
      tx.identifier.count({
        where: {
          systemId: system.id,
          status: IdentifierStatus.IN_STOCK,
          ownerId: null,
          deviceId: null,
        },
      }),
    ]);
    const effectiveAvailableExtensions = supportsIdentifiers ? availableExtensions : 0;

    const isLowStock =
      availableDevices <= system.lowStockThreshold ||
      (supportsIdentifiers && effectiveAvailableExtensions <= system.lowStockThreshold);

    if (!isLowStock) {
      return;
    }

    await this.outboxService.enqueue(
      {
        eventType: OutboxEventType.STOCK_LOW,
        aggregateType: 'SYSTEM_STOCK',
        aggregateId: system.id,
        tenantId: tenantId ?? null,
        systemId: system.id,
        payload: {
          systemId: system.id,
          systemCode: system.code,
          systemName: system.name,
          threshold: system.lowStockThreshold,
          availableDevices,
          availableExtensions: effectiveAvailableExtensions,
        },
      },
      tx,
    );
  }

  private supportsIdentifiers(system: { code: HardwareSystemCode; hasIdentifiers: boolean }): boolean {
    return system.code !== HardwareSystemCode.FEEDBACK && system.hasIdentifiers;
  }
}
