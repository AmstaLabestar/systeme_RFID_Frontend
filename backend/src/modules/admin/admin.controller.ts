import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateBusinessSystemDto } from '../systems/dto/create-business-system.dto';
import { UpdateBusinessSystemStatusDto } from '../systems/dto/update-business-system-status.dto';
import { BusinessSystemsService } from '../systems/business-systems.service';
import { AddDeviceIdentifiersDto } from './dto/add-device-identifiers.dto';
import { BulkCreateDevicesDto } from './dto/bulk-create-devices.dto';
import { BulkCreateIdentifiersDto } from './dto/bulk-create-identifiers.dto';
import { AdminAuditService } from './admin-audit.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class AdminController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly adminAuditService: AdminAuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('systems')
  listSystems() {
    return this.inventoryService.listSystemsWithStock(true);
  }

  @Post('systems')
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
