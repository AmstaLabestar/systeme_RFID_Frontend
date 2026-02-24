import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignIdentifierDto } from './dto/assign-identifier.dto';
import { ReassignIdentifierDto } from './dto/reassign-identifier.dto';
import {
  appendHistoryEvent,
  createId,
  getModuleActionLabel,
  upsertEmployee,
} from '../systems/domain/system-state.utils';
import type { ServiceAssignment } from '../systems/domain/system-state.types';
import { SystemsStateService } from '../systems/systems-state.service';

@Injectable()
export class AccessService {
  constructor(private readonly systemsStateService: SystemsStateService) {}

  getServicesState(userId: string) {
    return this.systemsStateService.getServicesState(userId);
  }

  async assignIdentifier(userId: string, dto: AssignIdentifierDto) {
    const [marketplaceState, servicesState] = await Promise.all([
      this.systemsStateService.getMarketplaceState(userId),
      this.systemsStateService.getServicesState(userId),
    ]);

    const device = marketplaceState.devices.find(
      (candidate) => candidate.id === dto.deviceId && candidate.module === dto.module,
    );
    if (!device) {
      throw new NotFoundException('Boitier introuvable pour ce module.');
    }

    if (!device.configured) {
      throw new BadRequestException('Configurez ce boitier avant l attribution.');
    }

    const employee = upsertEmployee(servicesState, dto.firstName, dto.lastName);
    const alreadyAssigned = servicesState.assignments.some(
      (assignment) => assignment.module === dto.module && assignment.employeeId === employee.id,
    );
    if (alreadyAssigned) {
      throw new BadRequestException('Cet employee possede deja un identifiant sur ce module.');
    }

    const identifier = marketplaceState.inventory.find((candidate) => candidate.id === dto.identifierId);
    if (!identifier) {
      throw new NotFoundException('Identifiant introuvable dans l inventaire.');
    }

    if (identifier.module !== dto.module) {
      throw new BadRequestException('Cet identifiant n est pas compatible avec ce module.');
    }

    if (identifier.status === 'assigned') {
      throw new BadRequestException('Cet identifiant est deja attribue.');
    }

    identifier.status = 'assigned';
    identifier.employeeId = employee.id;
    identifier.deviceId = dto.deviceId;

    const now = new Date().toISOString();
    const assignment: ServiceAssignment = {
      id: createId('asn'),
      module: dto.module,
      deviceId: dto.deviceId,
      identifierId: dto.identifierId,
      employeeId: employee.id,
      createdAt: now,
      updatedAt: now,
    };

    servicesState.assignments = [assignment, ...servicesState.assignments];
    appendHistoryEvent(servicesState, {
      module: dto.module,
      deviceId: device.id,
      employee: employee.fullName,
      identifier: identifier.code,
      device: device.name,
      action: getModuleActionLabel(dto.module, 'assign'),
    });

    const [savedServicesState, savedMarketplaceState] = await Promise.all([
      this.systemsStateService.saveServicesState(userId, servicesState),
      this.systemsStateService.saveMarketplaceState(userId, marketplaceState),
    ]);

    return {
      servicesState: savedServicesState,
      marketplaceState: savedMarketplaceState,
      meta: {
        module: dto.module,
        action: 'assign',
        employeeName: employee.fullName,
        identifierCode: identifier.code,
        deviceName: device.name,
      },
    };
  }

  async removeAssignment(userId: string, assignmentId: string) {
    const [marketplaceState, servicesState] = await Promise.all([
      this.systemsStateService.getMarketplaceState(userId),
      this.systemsStateService.getServicesState(userId),
    ]);

    const assignment = servicesState.assignments.find((entry) => entry.id === assignmentId);
    if (!assignment) {
      throw new NotFoundException('Association introuvable.');
    }

    const employee = servicesState.employees.find((entry) => entry.id === assignment.employeeId);
    const device = marketplaceState.devices.find((entry) => entry.id === assignment.deviceId);
    const identifier = marketplaceState.inventory.find((entry) => entry.id === assignment.identifierId);

    if (!employee || !device || !identifier) {
      throw new BadRequestException('Donnees incompletes pour retirer cette association.');
    }

    identifier.status = 'available';
    identifier.employeeId = undefined;

    servicesState.assignments = servicesState.assignments.filter((entry) => entry.id !== assignmentId);
    appendHistoryEvent(servicesState, {
      module: assignment.module,
      deviceId: device.id,
      employee: employee.fullName,
      identifier: identifier.code,
      device: device.name,
      action: getModuleActionLabel(assignment.module, 'remove'),
    });

    const [savedServicesState, savedMarketplaceState] = await Promise.all([
      this.systemsStateService.saveServicesState(userId, servicesState),
      this.systemsStateService.saveMarketplaceState(userId, marketplaceState),
    ]);

    return {
      servicesState: savedServicesState,
      marketplaceState: savedMarketplaceState,
      meta: {
        module: assignment.module,
        action: 'remove',
        employeeName: employee.fullName,
        identifierCode: identifier.code,
        deviceName: device.name,
      },
    };
  }

  async reassignIdentifier(userId: string, assignmentId: string, dto: ReassignIdentifierDto) {
    const [marketplaceState, servicesState] = await Promise.all([
      this.systemsStateService.getMarketplaceState(userId),
      this.systemsStateService.getServicesState(userId),
    ]);

    const assignment = servicesState.assignments.find((entry) => entry.id === assignmentId);
    if (!assignment) {
      throw new NotFoundException('Association introuvable pour la reattribution.');
    }

    const targetDevice = marketplaceState.devices.find((device) => device.id === dto.deviceId);
    if (!targetDevice || !targetDevice.configured || targetDevice.module !== assignment.module) {
      throw new BadRequestException('Boitier cible invalide.');
    }

    const employee = upsertEmployee(servicesState, dto.firstName, dto.lastName);
    const duplicateEmployeeAssignment = servicesState.assignments.find(
      (entry) =>
        entry.module === assignment.module &&
        entry.employeeId === employee.id &&
        entry.id !== assignment.id,
    );

    if (duplicateEmployeeAssignment) {
      throw new BadRequestException('Cet employee possede deja un identifiant sur ce module.');
    }

    const identifier = marketplaceState.inventory.find((entry) => entry.id === assignment.identifierId);
    if (!identifier) {
      throw new BadRequestException('Identifiant indisponible.');
    }

    identifier.status = 'assigned';
    identifier.employeeId = employee.id;
    identifier.deviceId = targetDevice.id;

    assignment.employeeId = employee.id;
    assignment.deviceId = targetDevice.id;
    assignment.updatedAt = new Date().toISOString();

    appendHistoryEvent(servicesState, {
      module: assignment.module,
      deviceId: targetDevice.id,
      employee: employee.fullName,
      identifier: identifier.code,
      device: targetDevice.name,
      action: 'Reattribution identifiant',
    });

    const [savedServicesState, savedMarketplaceState] = await Promise.all([
      this.systemsStateService.saveServicesState(userId, servicesState),
      this.systemsStateService.saveMarketplaceState(userId, marketplaceState),
    ]);

    return {
      servicesState: savedServicesState,
      marketplaceState: savedMarketplaceState,
      meta: {
        module: assignment.module,
        action: 'reassign',
        employeeName: employee.fullName,
        identifierCode: identifier.code,
        deviceName: targetDevice.name,
      },
    };
  }
}
