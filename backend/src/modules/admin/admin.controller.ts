import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateBusinessSystemDto } from '../systems/dto/create-business-system.dto';
import { UpdateBusinessSystemPricingDto } from '../systems/dto/update-business-system-pricing.dto';
import { UpdateBusinessSystemStatusDto } from '../systems/dto/update-business-system-status.dto';
import { BusinessSystemsService } from '../systems/business-systems.service';
import { AddDeviceIdentifiersDto } from './dto/add-device-identifiers.dto';
import { BulkCreateDevicesDto } from './dto/bulk-create-devices.dto';
import { BulkCreateIdentifiersDto } from './dto/bulk-create-identifiers.dto';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { ListAdminAuditQueryDto } from './dto/list-admin-audit-query.dto';
import { ListAdminInventoryQueryDto } from './dto/list-admin-inventory-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { UpdateWebhookActivationDto } from './dto/update-webhook-activation.dto';
import { ValidateDevicesImportDto } from './dto/validate-devices-import.dto';
import { AdminAuditService } from './admin-audit.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly adminAuditService: AdminAuditService,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('systems')
  listSystems() {
    return this.inventoryService.listSystemsWithStock(true);
  }

  @Get('inventory/devices')
  listInventoryDevices(@Query() query: ListAdminInventoryQueryDto) {
    return this.inventoryService.listDeviceInventory({
      page: query.page,
      limit: query.limit,
      systemId: query.systemId,
      systemCode: query.systemCode,
      status: query.status,
      warehouseCode: query.warehouseCode,
      search: query.search,
    });
  }

  @Get('inventory/devices/:id')
  getInventoryDevice(@Param('id') deviceId: string) {
    return this.inventoryService.getDeviceInventoryDetail(deviceId);
  }

  @Get('inventory/alerts/low-stock')
  listLowStockAlerts() {
    return this.inventoryService.listLowStockAlerts();
  }

  @Get('inventory/movements')
  listStockMovements(@Query() query: ListStockMovementsQueryDto) {
    return this.stockLedgerService.listMovements({
      page: query.page,
      limit: query.limit,
      systemId: query.systemId,
      resourceType: query.resourceType,
      action: query.action,
      warehouseCode: query.warehouseCode,
      search: query.search,
    });
  }

  @Get('logs')
  listAdminLogs(@Query() query: ListAdminAuditQueryDto) {
    return this.adminAuditService.listLogs({
      page: query.page,
      limit: query.limit,
      action: query.action,
      targetType: query.targetType,
      actorId: query.actorId,
    });
  }

  @Get('webhooks')
  listWebhooks() {
    return this.outboxService.listWebhookEndpoints();
  }

  @Post('webhooks')
  async createWebhook(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    const payload = dto.normalize();
    const webhook = await this.outboxService.createWebhookEndpoint({
      name: payload.name,
      url: payload.url,
      events: payload.events,
      secret: payload.secret,
    });

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'WEBHOOK_CREATED',
      targetType: 'WEBHOOK',
      targetId: webhook.id,
      details: {
        events: payload.events,
      },
    });

    return webhook;
  }

  @Patch('webhooks/:id/activation')
  async setWebhookActivation(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') webhookId: string,
    @Body() dto: UpdateWebhookActivationDto,
  ) {
    const updated = await this.outboxService.setWebhookActivation(webhookId, dto.isActive);

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'WEBHOOK_ACTIVATION_UPDATED',
      targetType: 'WEBHOOK',
      targetId: webhookId,
      details: {
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  @Post('webhooks/:id/test')
  async testWebhook(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') webhookId: string,
    @Body() dto: TestWebhookDto,
  ) {
    const result = await this.outboxService.testWebhookDelivery(webhookId, dto.eventType);

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'WEBHOOK_TEST_TRIGGERED',
      targetType: 'WEBHOOK',
      targetId: webhookId,
      details: {
        eventType: dto.eventType ?? 'ORDER_ALLOCATED',
      },
    });

    return result;
  }

  @Post('systems')
  @Roles('admin')
  async createSystem(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateBusinessSystemDto,
  ) {
    const createdSystem = await this.businessSystemsService.createSystem(dto);

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'SYSTEM_CREATED',
      targetType: 'SYSTEM',
      targetId: createdSystem.id,
      details: {
        code: createdSystem.code,
      },
    });

    return createdSystem;
  }

  @Patch('systems/:id/activation')
  async updateSystemActivation(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') systemId: string,
    @Body() dto: UpdateBusinessSystemStatusDto,
  ) {
    const updated = await this.businessSystemsService.setSystemActivation(systemId, dto.isActive);

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'SYSTEM_ACTIVATION_UPDATED',
      targetType: 'SYSTEM',
      targetId: updated.id,
      details: {
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  @Patch('systems/:id/pricing')
  async updateSystemPricing(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') systemId: string,
    @Body() dto: UpdateBusinessSystemPricingDto,
  ) {
    const updated = await this.businessSystemsService.setSystemPricing(systemId, dto);

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'SYSTEM_PRICING_UPDATED',
      targetType: 'SYSTEM',
      targetId: updated.id,
      details: {
        deviceUnitPriceCents: updated.deviceUnitPriceCents,
        extensionUnitPriceCents: updated.extensionUnitPriceCents,
        currency: updated.currency,
      },
    });

    return updated;
  }

  @Post('systems/:id/devices/bulk')
  async createDevicesBulk(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') systemId: string,
    @Body() dto: BulkCreateDevicesDto,
  ) {
    const payload = dto.normalize();
    const createdDevices = await this.inventoryService.createDevicesInBulk({
      systemId,
      quantity: payload.quantity,
      devices: payload.devices,
      warehouseCode: payload.warehouseCode,
      createdById: user.userId,
    });

    const devicesWithIdentifiers = createdDevices.length
      ? await this.prisma.device.findMany({
          where: {
            id: {
              in: createdDevices.map((device) => device.id),
            },
          },
          orderBy: { createdAt: 'asc' },
          include: {
            system: true,
            identifiers: {
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : [];

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'DEVICE_BULK_STOCK_CREATED',
      targetType: 'SYSTEM',
      targetId: systemId,
      details: {
        quantity: createdDevices.length,
      },
    });

    return {
      created: createdDevices.length,
      devices: devicesWithIdentifiers,
    };
  }

  @Post('systems/:id/devices/import/validate')
  validateDevicesImport(
    @Param('id') systemId: string,
    @Body() dto: ValidateDevicesImportDto,
  ) {
    const payload = dto.normalize();
    return this.inventoryService.validateDeviceImportBatch({
      systemId,
      devices: payload.devices,
      warehouseCode: payload.warehouseCode,
    });
  }

  @Post('systems/:id/identifiers/bulk')
  async createSystemIdentifiersBulk(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') systemId: string,
    @Body() dto: BulkCreateIdentifiersDto,
  ) {
    const payload = dto.normalize();
    const createdIdentifiers = await this.inventoryService.addIdentifiersToSystemStock({
      systemId,
      physicalIdentifiers: payload.physicalIdentifiers,
      type: payload.type,
      warehouseCode: payload.warehouseCode,
      createdById: user.userId,
    });

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'IDENTIFIER_SYSTEM_STOCK_CREATED',
      targetType: 'SYSTEM',
      targetId: systemId,
      details: {
        quantity: createdIdentifiers.length,
      },
    });

    return {
      created: createdIdentifiers.length,
      identifiers: createdIdentifiers,
    };
  }

  @Post('devices/:id/identifiers')
  async createDeviceIdentifiers(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') deviceId: string,
    @Body() dto: AddDeviceIdentifiersDto,
  ) {
    const payload = dto.normalize();
    const createdIdentifiers = await this.inventoryService.addIdentifiersToDevice({
      deviceId,
      type: payload.type,
      physicalIdentifiers: payload.physicalIdentifiers,
      createdById: user.userId,
    });

    await this.adminAuditService.createLog({
      actorId: user.userId,
      action: 'IDENTIFIER_DEVICE_STOCK_CREATED',
      targetType: 'DEVICE',
      targetId: deviceId,
      details: {
        quantity: createdIdentifiers.length,
      },
    });

    return {
      created: createdIdentifiers.length,
      identifiers: createdIdentifiers,
    };
  }
}
