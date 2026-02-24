import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const PUBLIC_USER_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  googleId: true,
  provider: true,
  isTwoFactorEnabled: true,
  tenantId: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      permissions: true,
      tenantId: true,
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      domain: true,
    },
  },
});

const AUTH_USER_SELECT = Prisma.validator<Prisma.UserSelect>()({
  ...PUBLIC_USER_SELECT,
  passwordHash: true,
  twoFactorSecretEncrypted: true,
  twoFactorSecretIv: true,
  twoFactorSecretTag: true,
  twoFactorSecretHash: true,
});

export type PublicUserRecord = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;
export type AuthUserRecord = Prisma.UserGetPayload<{ select: typeof AUTH_USER_SELECT }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPublicById(id: string): Promise<PublicUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
  }

  findAuthById(id: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: AUTH_USER_SELECT,
    });
  }

  findAuthByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: AUTH_USER_SELECT,
    });
  }

  findAuthByPhoneNumber(phoneNumber: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
      select: AUTH_USER_SELECT,
    });
  }

  findAuthByGoogleId(googleId: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
      select: AUTH_USER_SELECT,
    });
  }

  create(data: Prisma.UserCreateInput): Promise<AuthUserRecord> {
    return this.prisma.user.create({
      data,
      select: AUTH_USER_SELECT,
    });
  }

  updateById(id: string, data: Prisma.UserUpdateInput): Promise<AuthUserRecord> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: AUTH_USER_SELECT,
    });
  }

  async paginate(
    skip: number,
    take: number,
    tenantId?: string,
  ): Promise<{ data: PublicUserRecord[]; total: number }> {
    const where: Prisma.UserWhereInput = tenantId ? { tenantId } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: PUBLIC_USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total };
  }
}
