import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TwoFactorAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const user = request.user;

    if (!user?.isTwoFactorAuthenticated) {
      throw new ForbiddenException('Two-factor authentication required.');
    }

    return true;
  }
}
