import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AllocationsModule } from './modules/allocations/allocations.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessModule } from './modules/access/access.module';
import { CommonModule } from './modules/common/common.module';
import { DevicesModule } from './modules/devices/devices.module';
import { IdentifiersModule } from './modules/identifiers/identifiers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PublicFeedbackModule } from './modules/public-feedback/public-feedback.module';
import { RolesModule } from './modules/roles/roles.module';
import { SystemsModule } from './modules/systems/systems.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      expandVariables: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    CommonModule,
    TenantsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    SystemsModule,
    IdentifiersModule,
    InventoryModule,
    OrdersModule,
    AllocationsModule,
    MarketplaceModule,
    DevicesModule,
    AdminModule,
    AccessModule,
    PublicFeedbackModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
