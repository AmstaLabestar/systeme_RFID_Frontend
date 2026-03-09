import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UsersService } from './users.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  const usersRepository = {
    findAuthByEmail: jest.fn(),
    findAuthByPhoneNumber: jest.fn(),
    create: jest.fn(),
    paginate: jest.fn(),
    findPublicById: jest.fn(),
  };

  const tenantsRepository = {
    findById: jest.fn(),
  };

  const rolesRepository = {
    findById: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue(12),
  } as unknown as ConfigService;

  let service: UsersService;

  beforeEach(() => {
    service = new UsersService(
      usersRepository as any,
      tenantsRepository as any,
      rolesRepository as any,
      configService,
    );
  });

  it('rejects cross-tenant user creation', async () => {
    await expect(
      service.createUser(
        { tenantId: 'tenant-1' } as any,
        {
          tenantId: 'tenant-2',
          roleId: 'role-1',
          email: 'alice@example.com',
          name: 'Alice Martin',
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate email addresses', async () => {
    usersRepository.findAuthByEmail.mockResolvedValueOnce({ id: 'existing-user' });
    usersRepository.findAuthByPhoneNumber.mockResolvedValueOnce(null);
    tenantsRepository.findById.mockResolvedValueOnce({ id: 'tenant-1' });
    rolesRepository.findById.mockResolvedValueOnce({ id: 'role-1', tenantId: 'tenant-1' });

    await expect(
      service.createUser(
        { tenantId: 'tenant-1' } as any,
        {
          tenantId: 'tenant-1',
          roleId: 'role-1',
          email: 'alice@example.com',
          phoneNumber: '+15550123456',
          name: 'Alice Martin',
        } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when the target tenant does not exist', async () => {
    usersRepository.findAuthByEmail.mockResolvedValueOnce(null);
    usersRepository.findAuthByPhoneNumber.mockResolvedValueOnce(null);
    tenantsRepository.findById.mockResolvedValueOnce(null);
    rolesRepository.findById.mockResolvedValueOnce({ id: 'role-1', tenantId: 'tenant-1' });

    await expect(
      service.createUser(
        { tenantId: 'tenant-1' } as any,
        {
          tenantId: 'tenant-1',
          roleId: 'role-1',
          email: 'alice@example.com',
          name: 'Alice Martin',
        } as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a user and hashes the password when all dependencies are valid', async () => {
    usersRepository.findAuthByEmail.mockResolvedValueOnce(null);
    usersRepository.findAuthByPhoneNumber.mockResolvedValueOnce(null);
    tenantsRepository.findById.mockResolvedValueOnce({ id: 'tenant-1', name: 'Tenant A' });
    rolesRepository.findById.mockResolvedValueOnce({ id: 'role-1', tenantId: 'tenant-1', name: 'admin' });
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password');
    usersRepository.create.mockResolvedValueOnce({
      id: 'user-1',
      name: 'Alice Martin',
      email: 'alice@example.com',
      phoneNumber: '+15550123456',
      googleId: null,
      provider: 'LOCAL',
      isTwoFactorEnabled: false,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      role: {
        id: 'role-1',
        name: 'admin',
        permissions: ['users.manage'],
      },
      tenant: {
        id: 'tenant-1',
        name: 'Tenant A',
        domain: 'tenant-a.local',
      },
    });

    const result = await service.createUser(
      { tenantId: 'tenant-1' } as any,
      {
        tenantId: 'tenant-1',
        roleId: 'role-1',
        email: 'alice@example.com',
        phoneNumber: '+15550123456',
        password: 'StrongPass#123',
        name: 'Alice Martin',
      } as any,
    );

    expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass#123', 12);
    expect(usersRepository.create).toHaveBeenCalledWith({
      name: 'Alice Martin',
      email: 'alice@example.com',
      phoneNumber: '+15550123456',
      passwordHash: 'hashed-password',
      role: { connect: { id: 'role-1' } },
      tenant: { connect: { id: 'tenant-1' } },
    });
    expect(result).toMatchObject({
      id: 'user-1',
      firstName: 'Alice',
      lastName: 'Martin',
      company: 'Tenant A',
    });
  });

  it('lists users with pagination metadata', async () => {
    usersRepository.paginate.mockResolvedValueOnce({
      data: [
        {
          id: 'user-1',
          name: 'Alice Martin',
          email: 'alice@example.com',
          phoneNumber: null,
          googleId: null,
          provider: 'LOCAL',
          isTwoFactorEnabled: false,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
          role: { id: 'role-1', name: 'admin', permissions: ['users.read'] },
          tenant: { id: 'tenant-1', name: 'Tenant A', domain: 'tenant-a.local' },
        },
      ],
      total: 3,
    });
    const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 2 });

    await expect(service.listUsers({ tenantId: 'tenant-1' } as any, query as any)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'user-1',
          firstName: 'Alice',
          lastName: 'Martin',
        }),
      ],
      pagination: {
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(usersRepository.paginate).toHaveBeenCalledWith(2, 2, 'tenant-1');
  });

  it('throws when the user is missing or outside the actor tenant', async () => {
    usersRepository.findPublicById.mockResolvedValueOnce({
      id: 'user-1',
      tenant: { id: 'tenant-2', name: 'Tenant B', domain: 'tenant-b.local' },
    });

    await expect(
      service.getUserById({ tenantId: 'tenant-1' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
