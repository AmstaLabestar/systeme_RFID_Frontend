import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AllocationStatus,
  DeviceStatus,
  HardwareSystemCode,
  IdentifierStatus,
  OrderTargetType,
  Prisma,
  type Device,
  type Identifier,
  type Order,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
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
}

interface AllocationResult {
  order: Order;
  allocatedDevices: Device[];
  allocatedIdentifiers: Identifier[];
}

@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly ordersService: OrdersService,
  ) {}

  async allocateOrder(input: AllocateOrderInput) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity doit etre un entier strictement positif.');
    }

    const system = await this.businessSystemsService.getSystemByCodeOrThrow(input.systemCode, true);

    if (input.targetType === OrderTargetType.IDENTIFIER_EXTENSION && !system.hasIdentifiers) {
      throw new BadRequestException(
        'Ce systeme ne supporte pas l achat d extensions d identifiants.',
      );
    }

    if (input.targetType === OrderTargetType.IDENTIFIER_EXTENSION && !system.identifierType) {
      throw new BadRequestException(
        'Le type d identifiant de ce systeme est manquant. Contactez un administrateur.',
      );
    }

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

        const order = await this.ordersService.createOrder(
          {
            customerId: customer.id,
            tenantId: customer.tenantId,
            systemId: system.id,
            targetType: input.targetType,
            quantity: input.quantity,
          },
          tx,
        );

        const allocatedDeviceIds: string[] = [];
        const allocatedIdentifierIds: string[] = [];

        if (input.targetType === OrderTargetType.DEVICE) {
          // Business invariant: purchase never creates hardware, it only allocates pre-provisioned stock.
          const deviceIds = await this.lockDeviceIds(tx, system.id, input.quantity);
          if (deviceIds.length < input.quantity) {
            throw new BadRequestException('Stock de boitiers insuffisant pour cet achat.');
          }

          await this.reserveDevices(tx, deviceIds);

          for (const deviceId of deviceIds) {
            let qrCodeToken: string | undefined;
            let qrCodeDataUrl: string | undefined;

            if (system.code === HardwareSystemCode.FEEDBACK) {
              const qrPayload = await this.generateFeedbackQrCodePayload(tx);
              qrCodeToken = qrPayload.token;
              qrCodeDataUrl = qrPayload.dataUrl;
            }

            await tx.device.update({
              where: { id: deviceId },
              data: {
                status: DeviceStatus.ASSIGNED,
                ownerId: customer.id,
                ownerTenantId: customer.tenantId,
                assignedAt: new Date(),
                qrCodeToken,
                qrCodeDataUrl,
              },
            });
            allocatedDeviceIds.push(deviceId);

            if (system.hasIdentifiers && system.identifiersPerDevice > 0) {
              const bundledIdentifierIds = await this.lockBundledIdentifierIds(
                tx,
                deviceId,
                system.identifiersPerDevice,
              );

              if (bundledIdentifierIds.length < system.identifiersPerDevice) {
                throw new ConflictException(
                  `Boitier ${deviceId} sans lot complet d identifiants en stock.`,
                );
              }

              await this.reserveIdentifiers(tx, bundledIdentifierIds);
              await this.assignIdentifiers(
                tx,
                bundledIdentifierIds,
                customer.id,
                customer.tenantId,
              );
              allocatedIdentifierIds.push(...bundledIdentifierIds);
            }
          }
        } else {
          const extensionIdentifierIds = await this.lockStandaloneIdentifierIds(
            tx,
            system.id,
            system.identifierType!,
            input.quantity,
          );

          if (extensionIdentifierIds.length < input.quantity) {
            throw new BadRequestException('Stock d extensions insuffisant pour cet achat.');
          }

          await this.reserveIdentifiers(tx, extensionIdentifierIds);
          await this.assignIdentifiers(
            tx,
            extensionIdentifierIds,
            customer.id,
            customer.tenantId,
          );
          allocatedIdentifierIds.push(...extensionIdentifierIds);
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

        await this.ordersService.markCompleted(order.id, tx);

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
  }

  private async lockDeviceIds(
    tx: Prisma.TransactionClient,
    systemId: string,
    quantity: number,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM "devices"
      WHERE "systemId" = ${systemId}
        AND status = ${DeviceStatus.IN_STOCK}
        AND "ownerId" IS NULL
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${quantity}
    `);

    return rows.map((row) => row.id);
  }

  private async lockBundledIdentifierIds(
    tx: Prisma.TransactionClient,
    deviceId: string,
    quantity: number,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM "identifiers"
      WHERE "deviceId" = ${deviceId}
        AND status = ${IdentifierStatus.IN_STOCK}
        AND "ownerId" IS NULL
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${quantity}
    `);

    return rows.map((row) => row.id);
  }

  private async lockStandaloneIdentifierIds(
    tx: Prisma.TransactionClient,
    systemId: string,
    identifierType: Identifier['type'],
    quantity: number,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM "identifiers"
      WHERE "systemId" = ${systemId}
        AND "deviceId" IS NULL
        AND status = ${IdentifierStatus.IN_STOCK}
        AND "ownerId" IS NULL
        AND type = ${identifierType}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${quantity}
    `);

    return rows.map((row) => row.id);
  }

  private async reserveDevices(tx: Prisma.TransactionClient, deviceIds: string[]): Promise<void> {
    if (deviceIds.length === 0) {
      return;
    }

    const reserved = await tx.device.updateMany({
      where: {
        id: { in: deviceIds },
        status: DeviceStatus.IN_STOCK,
        ownerId: null,
      },
      data: {
        status: DeviceStatus.RESERVED,
      },
    });

    if (reserved.count !== deviceIds.length) {
      throw new ConflictException('Conflit de reservation: boitiers deja modifies.');
    }
  }

  private async reserveIdentifiers(
    tx: Prisma.TransactionClient,
    identifierIds: string[],
  ): Promise<void> {
    if (identifierIds.length === 0) {
      return;
    }

    const reserved = await tx.identifier.updateMany({
      where: {
        id: { in: identifierIds },
        status: IdentifierStatus.IN_STOCK,
        ownerId: null,
      },
      data: {
        status: IdentifierStatus.RESERVED,
      },
    });

    if (reserved.count !== identifierIds.length) {
      throw new ConflictException('Conflit de reservation: identifiants deja modifies.');
    }
  }

  private async assignIdentifiers(
    tx: Prisma.TransactionClient,
    identifierIds: string[],
    customerId: string,
    tenantId: string,
  ): Promise<void> {
    if (identifierIds.length === 0) {
      return;
    }

    const assigned = await tx.identifier.updateMany({
      where: {
        id: { in: identifierIds },
        status: IdentifierStatus.RESERVED,
      },
      data: {
        status: IdentifierStatus.ASSIGNED,
        ownerId: customerId,
        ownerTenantId: tenantId,
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
}
