import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    // Prisma v6 no longer exposes a typed `beforeExit` event on `$on`.
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
