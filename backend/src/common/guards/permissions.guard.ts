import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../permissions.constants';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AccessTokenPayload } from '../interfaces/jwt-payload.interface';

function normalizePermission(value: string): string {
  return value.trim().toLowerCase();
}

function toPermissionSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set<string>();
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => normalizePermission(entry))
    .filter((entry) => entry.length > 0);

  return new Set(normalized);
}

function hasPermission(grantedPermissions: Set<string>, requiredPermission: string): boolean {
  if (grantedPermissions.has('*') || grantedPermissions.has(requiredPermission)) {
    return true;
  }

  for (const grantedPermission of grantedPermissions) {
    if (!grantedPermission.endsWith('*') || grantedPermission.length <= 1) {
      continue;
    }

    const prefix = grantedPermission.slice(0, -1);
    if (requiredPermission.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Insufficient permission scope.');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        tenantId: true,
        role: {
          select: {
            name: true,
            tenantId: true,
            permissions: true,
          },
        },
      },
    });

    const tenantMismatch =
      !dbUser || dbUser.tenantId !== user.tenantId || dbUser.role?.tenantId !== user.tenantId;
    if (tenantMismatch || !dbUser?.role) {
      throw new ForbiddenException('Insufficient permission scope.');
    }

    const grantedPermissions = toPermissionSet(dbUser.role.permissions);
    if (grantedPermissions.size === 0) {
      const defaultPermissions =
        DEFAULT_ROLE_PERMISSIONS[normalizePermission(dbUser.role.name)] ?? [];
      defaultPermissions.forEach((permission) =>
        grantedPermissions.add(normalizePermission(permission)),
      );
    }
    const normalizedRequiredPermissions = requiredPermissions
      .map((permission) => normalizePermission(permission))
      .filter((permission) => permission.length > 0);

    const isAllowed = normalizedRequiredPermissions.some((permission) =>
      hasPermission(grantedPermissions, permission),
    );

    if (!isAllowed) {
      throw new ForbiddenException('Insufficient permission scope.');
    }

    return true;
  }
}
