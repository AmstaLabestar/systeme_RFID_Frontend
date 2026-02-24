import { Injectable } from '@nestjs/common';
import { Prisma, RefreshToken } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RefreshTokenCreateInput): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByJti(jti: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { jti },
    });
  }

  revokeById(id: string, replacedByTokenId?: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId,
      },
    });
  }

  revokeByUserId(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
