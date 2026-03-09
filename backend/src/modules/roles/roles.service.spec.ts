import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  const rolesRepository = {
    findByNameInTenant: jest.fn(),
    create: jest.fn(),
    paginate: jest.fn(),
    findById: jest.fn(),
  };

  const tenantsRepository = {
    findById: jest.fn(),
  };

  let service: RolesService;

  beforeEach(() => {
    service = new RolesService(rolesRepository as any, tenantsRepository as any);
  });

  it('rejects cross-tenant role creation', async () => {
    await expect(
      service.createRole(
        { tenantId: 'tenant-1' } as any,
        { tenantId: 'tenant-2', name: 'admin', permissions: ['users.read'] } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when the tenant does not exist', async () => {
    tenantsRepository.findById.mockResolvedValueOnce(null);

    await expect(
      service.createRole(
        { tenantId: 'tenant-1' } as any,
        { tenantId: 'tenant-1', name: 'admin', permissions: ['users.read'] } as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when the role already exists in the tenant', async () => {
    tenantsRepository.findById.mockResolvedValueOnce({ id: 'tenant-1' });
    rolesRepository.findByNameInTenant.mockResolvedValueOnce({ id: 'role-1' });

    await expect(
      service.createRole(
        { tenantId: 'tenant-1' } as any,
        { tenantId: 'tenant-1', name: 'admin', permissions: ['users.read'] } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a role with the tenant relation', async () => {
    tenantsRepository.findById.mockResolvedValueOnce({ id: 'tenant-1' });
    rolesRepository.findByNameInTenant.mockResolvedValueOnce(null);
    rolesRepository.create.mockResolvedValueOnce({ id: 'role-1', name: 'admin' });

    await expect(
      service.createRole(
        { tenantId: 'tenant-1' } as any,
        { tenantId: 'tenant-1', name: 'admin', permissions: ['users.read'] } as any,
      ),
    ).resolves.toEqual({ id: 'role-1', name: 'admin' });
    expect(rolesRepository.create).toHaveBeenCalledWith({
      name: 'admin',
      permissions: ['users.read'],
      tenant: {
        connect: { id: 'tenant-1' },
      },
    });
  });

  it('lists roles with tenant-scoped pagination', async () => {
    rolesRepository.paginate.mockResolvedValueOnce({
      data: [{ id: 'role-1' }],
      total: 3,
    });
    const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 2 });

    await expect(service.listRoles({ tenantId: 'tenant-1' } as any, query as any)).resolves.toEqual({
      data: [{ id: 'role-1' }],
      pagination: {
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(rolesRepository.paginate).toHaveBeenCalledWith(2, 2, 'tenant-1');
  });

  it('throws when a role is outside the actor tenant', async () => {
    rolesRepository.findById.mockResolvedValueOnce({ id: 'role-1', tenantId: 'tenant-2' });

    await expect(
      service.getRoleById({ tenantId: 'tenant-1' } as any, 'role-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
