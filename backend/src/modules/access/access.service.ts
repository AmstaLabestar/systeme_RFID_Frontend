import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus, HardwareSystemCode, IdentifierType, Prisma } from '@prisma/client';
import { AssignIdentifierDto } from './dto/assign-identifier.dto';
import { GetServicesStateQueryDto } from './dto/get-services-state-query.dto';
import type { GetServicesStateResponseDto } from './dto/get-services-state-response.dto';
import { ReassignIdentifierDto } from './dto/reassign-identifier.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type ModuleKey = 'rfid-presence' | 'rfid-porte' | 'biometrie' | 'feedback';

const MODULE_TO_SYSTEM_CODE: Record<ModuleKey, HardwareSystemCode> = {
  'rfid-presence': HardwareSystemCode.RFID_PRESENCE,
  'rfid-porte': HardwareSystemCode.RFID_PORTE,
  biometrie: HardwareSystemCode.BIOMETRIE,
  feedback: HardwareSystemCode.FEEDBACK,
};

const SYSTEM_CODE_TO_MODULE: Record<HardwareSystemCode, ModuleKey> = {
  [HardwareSystemCode.RFID_PRESENCE]: 'rfid-presence',
  [HardwareSystemCode.RFID_PORTE]: 'rfid-porte',
  [HardwareSystemCode.BIOMETRIE]: 'biometrie',
  [HardwareSystemCode.FEEDBACK]: 'feedback',
};

const ASSIGN_ACTION_LABELS: Record<Exclude<ModuleKey, 'feedback'>, string> = {
  'rfid-presence': 'Association badge employee',
  'rfid-porte': 'Association identifiant porte',
  biometrie: 'Association empreinte employee',
};

const REMOVE_ACTION_LABELS: Record<Exclude<ModuleKey, 'feedback'>, string> = {
  'rfid-presence': 'Retrait badge employee',
  'rfid-porte': 'Retrait identifiant porte',
  biometrie: 'Retrait empreinte employee',
};

function toSystemCode(moduleKey: string): HardwareSystemCode {
  const resolved = MODULE_TO_SYSTEM_CODE[moduleKey as ModuleKey];
  if (!resolved) {
    throw new BadRequestException('Module invalide.');
  }
  return resolved;
}

function toModuleKey(systemCode: HardwareSystemCode): ModuleKey {
  return SYSTEM_CODE_TO_MODULE[systemCode];
}

function toIdentifierType(type: IdentifierType): 'badge-rfid' | 'empreinte' | 'serrure-rfid' {
  if (type === IdentifierType.BADGE) {
    return 'badge-rfid';
  }
  if (type === IdentifierType.EMPREINTE) {
    return 'empreinte';
  }
  return 'serrure-rfid';
}

function normalizeEmployeeName(firstName: string, lastName: string): {
  firstName: string;
  lastName: string;
  fullName: string;
  normalizedFullName: string;
} {
  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
  const normalizedFullName = fullName.toLowerCase();

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    fullName,
    normalizedFullName,
  };
}

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getServicesState(
    userId: string,
    query: GetServicesStateQueryDto = new GetServicesStateQueryDto(),
  ): Promise<GetServicesStateResponseDto> {
    const paginate = query.paginate;
    const employeesTake = paginate ? query.employeesLimit + 1 : undefined;
    const assignmentsTake = paginate ? query.assignmentsLimit + 1 : undefined;
    const historyTake = paginate ? query.historyLimit + 1 : undefined;
    const feedbackTake = paginate ? query.feedbackLimit + 1 : undefined;

    const [rawEmployees, rawAssignments, rawHistoryEvents, rawFeedbackEvents] = await (async () => {
      try {
        return await Promise.all([
          this.prisma.employee.findMany({
            where: { ownerId: userId },
            ...(paginate && query.employeesCursor
              ? {
                  cursor: { id: query.employeesCursor },
                  skip: 1,
                }
              : {}),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...(employeesTake ? { take: employeesTake } : {}),
          }),
          this.prisma.serviceAssignment.findMany({
            where: { ownerId: userId },
            ...(paginate && query.assignmentsCursor
              ? {
                  cursor: { id: query.assignmentsCursor },
                  skip: 1,
                }
              : {}),
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            ...(assignmentsTake ? { take: assignmentsTake } : {}),
          }),
          this.prisma.serviceHistoryEvent.findMany({
            where: { ownerId: userId },
            ...(paginate && query.historyCursor
              ? {
                  cursor: { id: query.historyCursor },
                  skip: 1,
                }
              : {}),
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            ...(historyTake ? { take: historyTake } : {}),
          }),
          this.prisma.feedbackEvent.findMany({
            where: { ownerId: userId },
            ...(paginate && query.feedbackCursor
              ? {
                  cursor: { id: query.feedbackCursor },
                  skip: 1,
                }
              : {}),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...(feedbackTake ? { take: feedbackTake } : {}),
          }),
        ]);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new BadRequestException('Cursor de pagination invalide.');
        }
        throw error;
      }
    })();

    const hasMoreEmployees = paginate && rawEmployees.length > query.employeesLimit;
    const hasMoreAssignments = paginate && rawAssignments.length > query.assignmentsLimit;
    const hasMoreHistory = paginate && rawHistoryEvents.length > query.historyLimit;
    const hasMoreFeedback = paginate && rawFeedbackEvents.length > query.feedbackLimit;
    const employees = hasMoreEmployees ? rawEmployees.slice(0, query.employeesLimit) : rawEmployees;
    const assignments = hasMoreAssignments
      ? rawAssignments.slice(0, query.assignmentsLimit)
      : rawAssignments;
    const historyEvents = hasMoreHistory
      ? rawHistoryEvents.slice(0, query.historyLimit)
      : rawHistoryEvents;
    const feedbackEvents = hasMoreFeedback
      ? rawFeedbackEvents.slice(0, query.feedbackLimit)
      : rawFeedbackEvents;

    return {
      employees: employees.map((employee) => ({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
      })),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        module: toModuleKey(assignment.module),
        deviceId: assignment.deviceId,
        identifierId: assignment.identifierId,
        employeeId: assignment.employeeId,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
      })),
      history: historyEvents.map((event) => ({
        id: event.id,
        module: toModuleKey(event.module),
        deviceId: event.deviceId,
        employee: event.employeeName,
        identifier: event.identifierCode,
        device: event.deviceName,
        action: event.action,
        occurredAt: event.occurredAt.toISOString(),
      })),
      feedbackRecords: feedbackEvents.map((event) => ({
        id: event.id,
        deviceId: event.deviceId,
        module: 'feedback' as const,
        sentiment: event.sentiment.toLowerCase(),
        source: event.source,
        comment: event.comment ?? undefined,
        createdAt: event.createdAt.toISOString(),
      })),
      pagination: {
        employees: {
          nextCursor: hasMoreEmployees ? (employees[employees.length - 1]?.id ?? null) : null,
          hasMore: hasMoreEmployees,
          limit: query.employeesLimit,
        },
        assignments: {
          nextCursor: hasMoreAssignments ? (assignments[assignments.length - 1]?.id ?? null) : null,
          hasMore: hasMoreAssignments,
          limit: query.assignmentsLimit,
        },
        history: {
          nextCursor: hasMoreHistory ? (historyEvents[historyEvents.length - 1]?.id ?? null) : null,
          hasMore: hasMoreHistory,
          limit: query.historyLimit,
        },
        feedbackRecords: {
          nextCursor: hasMoreFeedback
            ? (feedbackEvents[feedbackEvents.length - 1]?.id ?? null)
            : null,
          hasMore: hasMoreFeedback,
          limit: query.feedbackLimit,
        },
      },
    };
  }

  async assignIdentifier(userId: string, dto: AssignIdentifierDto) {
    const systemCode = toSystemCode(dto.module);
    if (systemCode === HardwareSystemCode.FEEDBACK) {
      throw new BadRequestException('Le module Feedback ne supporte pas ce type d attribution.');
    }

    const employeeMeta = normalizeEmployeeName(dto.firstName, dto.lastName);

    let assignmentMeta: { identifierCode: string; deviceName: string } | undefined;

    await this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({
        where: {
          id: dto.deviceId,
          ownerId: userId,
          status: DeviceStatus.ASSIGNED,
          system: { code: systemCode },
        },
        include: {
          system: true,
        },
      });

      if (!device) {
        throw new NotFoundException('Boitier introuvable pour ce module.');
      }

      if (!device.isConfigured) {
        throw new BadRequestException('Configurez ce boitier avant l attribution.');
      }

      const identifier = await tx.identifier.findFirst({
        where: {
          id: dto.identifierId,
          ownerId: userId,
          system: { code: systemCode },
        },
        include: {
          serviceAssignment: true,
        },
      });

      if (!identifier) {
        throw new NotFoundException('Identifiant introuvable dans l inventaire.');
      }

      if (identifier.serviceAssignment) {
        throw new BadRequestException('Cet identifiant est deja attribue.');
      }

      if (identifier.deviceId && identifier.deviceId !== dto.deviceId) {
        throw new BadRequestException('Cet identifiant est lie a un autre boitier.');
      }

      let employee = await tx.employee.findUnique({
        where: {
          ownerId_normalizedFullName: {
            ownerId: userId,
            normalizedFullName: employeeMeta.normalizedFullName,
          },
        },
      });

      if (!employee) {
        employee = await tx.employee.create({
          data: {
            ownerId: userId,
            firstName: employeeMeta.firstName,
            lastName: employeeMeta.lastName,
            normalizedFullName: employeeMeta.normalizedFullName,
          },
        });
      }

      const duplicateEmployeeAssignment = await tx.serviceAssignment.findFirst({
        where: {
          ownerId: userId,
          module: systemCode,
          employeeId: employee.id,
        },
        select: { id: true },
      });

      if (duplicateEmployeeAssignment) {
        throw new BadRequestException('Cet employee possede deja un identifiant sur ce module.');
      }

      await tx.serviceAssignment.create({
        data: {
          ownerId: userId,
          module: systemCode,
          deviceId: dto.deviceId,
          identifierId: dto.identifierId,
          employeeId: employee.id,
        },
      });

      await tx.serviceHistoryEvent.create({
        data: {
          ownerId: userId,
          module: systemCode,
          deviceId: device.id,
          identifierId: identifier.id,
          employeeId: employee.id,
          employeeName: employeeMeta.fullName,
          identifierCode: identifier.physicalIdentifier,
          deviceName: device.configuredName ?? device.system.name,
          action: ASSIGN_ACTION_LABELS[dto.module as Exclude<ModuleKey, 'feedback'>],
        },
      });

      assignmentMeta = {
        identifierCode: identifier.physicalIdentifier,
        deviceName: device.configuredName ?? device.system.name,
      };
    });

    const [savedServicesState, savedMarketplaceState] = await Promise.all([
      this.getServicesState(userId),
      this.getMarketplaceState(userId),
    ]);

    return {
      servicesState: savedServicesState,
      marketplaceState: savedMarketplaceState,
      meta: {
        module: dto.module,
        action: 'assign',
        employeeName: employeeMeta.fullName,
        identifierCode: assignmentMeta?.identifierCode ?? dto.identifierId,
        deviceName: assignmentMeta?.deviceName ?? dto.deviceId,
      },
    };
  }

  async removeAssignment(userId: string, assignmentId: string) {
    const assignment = await this.prisma.serviceAssignment.findFirst({
      where: {
        id: assignmentId,
        ownerId: userId,
      },
      include: {
        employee: true,
        device: {
          include: {
            system: true,
          },
        },
        identifier: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Association introuvable.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAssignment.delete({
        where: { id: assignment.id },
      });

      await tx.serviceHistoryEvent.create({
        data: {
          ownerId: userId,
          module: assignment.module,
          deviceId: assignment.deviceId,
          identifierId: assignment.identifierId,
          employeeId: assignment.employeeId,
          employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
          identifierCode: assignment.identifier.physicalIdentifier,
          deviceName: assignment.device.configuredName ?? assignment.device.system.name,
          action: REMOVE_ACTION_LABELS[
            toModuleKey(assignment.module) as Exclude<ModuleKey, 'feedback'>
          ],
        },
      });
    });

    const [savedServicesState, savedMarketplaceState] = await Promise.all([
      this.getServicesState(userId),
      this.getMarketplaceState(userId),
    ]);

    return {
      servicesState: savedServicesState,
      marketplaceState: savedMarketplaceState,
      meta: {
        module: toModuleKey(assignment.module),
        action: 'remove',
        employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
        identifierCode: assignment.identifier.physicalIdentifier,
        deviceName: assignment.device.configuredName ?? assignment.device.system.name,
      },
    };
  }

  async reassignIdentifier(userId: string, assignmentId: string, dto: ReassignIdentifierDto) {
    const assignment = await this.prisma.serviceAssignment.findFirst({
      where: {
        id: assignmentId,
        ownerId: userId,
      },
      include: {
        identifier: true,
        device: {
          include: {
            system: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Association introuvable pour la reattribution.');
    }

    const employeeMeta = normalizeEmployeeName(dto.firstName, dto.lastName);
    let reassignmentDeviceName: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const targetDevice = await tx.device.findFirst({
        where: {
          id: dto.deviceId,
          ownerId: userId,
          status: DeviceStatus.ASSIGNED,
          system: {
            code: assignment.module,
          },
        },
        include: {
          system: true,
        },
      });

      if (!targetDevice || !targetDevice.isConfigured) {
        throw new BadRequestException('Boitier cible invalide.');
      }

      if (assignment.identifier.deviceId && assignment.identifier.deviceId !== targetDevice.id) {
        throw new BadRequestException('Identifiant indisponible pour ce boitier cible.');
      }

      let employee = await tx.employee.findUnique({
        where: {
          ownerId_normalizedFullName: {
            ownerId: userId,
            normalizedFullName: employeeMeta.normalizedFullName,
          },
        },
      });

      if (!employee) {
        employee = await tx.employee.create({
          data: {
            ownerId: userId,
            firstName: employeeMeta.firstName,
            lastName: employeeMeta.lastName,
            normalizedFullName: employeeMeta.normalizedFullName,
          },
        });
      }

      const duplicateEmployeeAssignment = await tx.serviceAssignment.findFirst({
        where: {
          ownerId: userId,
          module: assignment.module,
          employeeId: employee.id,
          id: { not: assignment.id },
        },
        select: { id: true },
      });

      if (duplicateEmployeeAssignment) {
        throw new BadRequestException('Cet employee possede deja un identifiant sur ce module.');
      }

      await tx.serviceAssignment.update({
        where: { id: assignment.id },
        data: {
          employeeId: employee.id,
          deviceId: targetDevice.id,
        },
      });

      await tx.serviceHistoryEvent.create({
        data: {
          ownerId: userId,
          module: assignment.module,
          deviceId: targetDevice.id,
          identifierId: assignment.identifier.id,
          employeeId: employee.id,
          employeeName: employeeMeta.fullName,
          identifierCode: assignment.identifier.physicalIdentifier,
          deviceName: targetDevice.configuredName ?? targetDevice.system.name,
          action: 'Reattribution identifiant',
        },
      });

      reassignmentDeviceName = targetDevice.configuredName ?? targetDevice.system.name;
    });

    const [savedServicesState, savedMarketplaceState] = await Promise.all([
      this.getServicesState(userId),
      this.getMarketplaceState(userId),
    ]);

    return {
      servicesState: savedServicesState,
      marketplaceState: savedMarketplaceState,
      meta: {
        module: toModuleKey(assignment.module),
        action: 'reassign',
        employeeName: employeeMeta.fullName,
        identifierCode: assignment.identifier.physicalIdentifier,
        deviceName: reassignmentDeviceName ?? dto.deviceId,
      },
    };
  }

  private async getMarketplaceState(userId: string) {
    const [devices, standaloneIdentifiers] = await Promise.all([
      this.prisma.device.findMany({
        where: {
          ownerId: userId,
          status: DeviceStatus.ASSIGNED,
        },
        orderBy: { assignedAt: 'desc' },
        include: {
          system: true,
          identifiers: {
            where: {
              ownerId: userId,
            },
            include: {
              serviceAssignment: {
                select: {
                  employeeId: true,
                  deviceId: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.identifier.findMany({
        where: {
          ownerId: userId,
          deviceId: null,
        },
        orderBy: { createdAt: 'asc' },
        include: {
          system: true,
          serviceAssignment: {
            select: {
              employeeId: true,
              deviceId: true,
            },
          },
        },
      }),
    ]);

    const inventory = [
      ...devices.flatMap((device) =>
        device.identifiers.map((identifier) => ({
          id: identifier.id,
          module: toModuleKey(device.system.code),
          type: toIdentifierType(identifier.type),
          code: identifier.physicalIdentifier,
          status: identifier.serviceAssignment ? ('assigned' as const) : ('available' as const),
          deviceId: identifier.deviceId ?? identifier.serviceAssignment?.deviceId ?? undefined,
          employeeId: identifier.serviceAssignment?.employeeId,
          acquiredAt: identifier.createdAt.toISOString(),
        })),
      ),
      ...standaloneIdentifiers.map((identifier) => ({
        id: identifier.id,
        module: toModuleKey(identifier.system.code),
        type: toIdentifierType(identifier.type),
        code: identifier.physicalIdentifier,
        status: identifier.serviceAssignment ? ('assigned' as const) : ('available' as const),
        deviceId: identifier.deviceId ?? identifier.serviceAssignment?.deviceId ?? undefined,
        employeeId: identifier.serviceAssignment?.employeeId,
        acquiredAt: identifier.createdAt.toISOString(),
      })),
    ];

    return {
      productStockById: {} as Record<string, number | null>,
      devices: devices.map((device) => ({
        id: device.id,
        module: toModuleKey(device.system.code),
        name: device.configuredName ?? `${device.system.name} (${device.id.slice(0, 8)})`,
        location: device.configuredLocation ?? 'A configurer',
        provisionedMacAddress: device.macAddress,
        qrToken: device.qrCodeToken ?? undefined,
        systemIdentifier: device.isConfigured ? device.macAddress : undefined,
        configured: device.isConfigured,
        capacity: device.system.identifiersPerDevice,
        createdAt: (device.assignedAt ?? device.createdAt).toISOString(),
        activatedAt: device.isConfigured ? device.updatedAt.toISOString() : undefined,
      })),
      inventory,
    };
  }
}
