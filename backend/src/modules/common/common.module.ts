import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';

@Module({
  providers: [JwtAuthGuard, TwoFactorAuthGuard, RolesGuard, PermissionsGuard],
  exports: [JwtAuthGuard, TwoFactorAuthGuard, RolesGuard, PermissionsGuard],
})
export class CommonModule {}
