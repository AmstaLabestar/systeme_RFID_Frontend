import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AccessTokenPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Insufficient role permissions.');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    const roleName = dbUser?.role?.name;
    if (!roleName || !requiredRoles.includes(roleName)) {
      throw new ForbiddenException('Insufficient role permissions.');
    }

    return true;
  }
}
