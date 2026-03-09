import { Test } from '@nestjs/testing';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('TenantsController', () => {
  const tenantsService = {
    createTenant: jest.fn(),
    listTenants: jest.fn(),
    getTenantById: jest.fn(),
  };

  let controller: TenantsController;
  const allowGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: tenantsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(TwoFactorAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(allowGuard)
      .compile();

    controller = moduleRef.get(TenantsController);
  });

  it('creates a tenant through the service', async () => {
    const user = { userId: 'user-1' };
    const dto = { name: 'Tenant A' };
    tenantsService.createTenant.mockResolvedValueOnce({ id: 'tenant-1' });

    await expect(controller.create(user as any, dto as any)).resolves.toEqual({ id: 'tenant-1' });
    expect(tenantsService.createTenant).toHaveBeenCalledWith(user, dto);
  });

  it('lists tenants through the service', async () => {
    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
    tenantsService.listTenants.mockResolvedValueOnce({ data: [] });

    await expect(controller.list({ userId: 'user-1' } as any, query)).resolves.toEqual({ data: [] });
    expect(tenantsService.listTenants).toHaveBeenCalledWith({ userId: 'user-1' }, query);
  });

  it('gets a tenant by id through the service', async () => {
    tenantsService.getTenantById.mockResolvedValueOnce({ id: 'tenant-1' });

    await expect(controller.getById({ userId: 'user-1' } as any, 'tenant-1')).resolves.toEqual({
      id: 'tenant-1',
    });
    expect(tenantsService.getTenantById).toHaveBeenCalledWith({ userId: 'user-1' }, 'tenant-1');
  });
});
