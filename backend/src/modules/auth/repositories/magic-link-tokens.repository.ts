import { Injectable } from '@nestjs/common';
import { MagicLinkToken, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class MagicLinkTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MagicLinkTokenCreateInput): Promise<MagicLinkToken> {
    return this.prisma.magicLinkToken.create({ data });
  }

  findByJti(jti: string): Promise<MagicLinkToken | null> {
    return this.prisma.magicLinkToken.findUnique({
      where: { jti },
    });
  }

  markConsumed(id: string): Promise<MagicLinkToken> {
    return this.prisma.magicLinkToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  async consumeIfActive(id: string): Promise<boolean> {
    const result = await this.prisma.magicLinkToken.updateMany({
      where: {
        id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    return result.count === 1;
  }
}
