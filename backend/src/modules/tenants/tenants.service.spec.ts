import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  const tenantsRepository = {
    paginate: jest.fn(),
    findById: jest.fn(),
  };

  let service: TenantsService;

  beforeEach(() => {
    service = new TenantsService(tenantsRepository as any);
  });

  it('rejects tenant creation for application users', async () => {
    await expect(
      service.createTenant({ tenantId: 'tenant-1' } as any, { name: 'Tenant A' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists only tenants visible to the actor', async () => {
    tenantsRepository.paginate.mockResolvedValueOnce({
      data: [{ id: 'tenant-1', name: 'Tenant A' }],
      total: 1,
    });
    const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 5 });

    await expect(service.listTenants({ tenantId: 'tenant-1' } as any, query)).resolves.toEqual({
      data: [{ id: 'tenant-1', name: 'Tenant A' }],
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    });
    expect(tenantsRepository.paginate).toHaveBeenCalledWith(5, 5, 'tenant-1');
  });

  it('throws when asking for another tenant', async () => {
    await expect(
      service.getTenantById({ tenantId: 'tenant-1' } as any, 'tenant-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when the actor tenant does not exist anymore', async () => {
    tenantsRepository.findById.mockResolvedValueOnce(null);

    await expect(
      service.getTenantById({ tenantId: 'tenant-1' } as any, 'tenant-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the actor tenant when it exists', async () => {
    tenantsRepository.findById.mockResolvedValueOnce({ id: 'tenant-1', name: 'Tenant A' });

    await expect(service.getTenantById({ tenantId: 'tenant-1' } as any, 'tenant-1')).resolves.toEqual(
      { id: 'tenant-1', name: 'Tenant A' },
    );
  });
});
