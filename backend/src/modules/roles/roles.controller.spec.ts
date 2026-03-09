import { Test } from '@nestjs/testing';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

describe('RolesController', () => {
  const rolesService = {
    createRole: jest.fn(),
    listRoles: jest.fn(),
    getRoleById: jest.fn(),
  };

  let controller: RolesController;
  const allowGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: rolesService,
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

    controller = moduleRef.get(RolesController);
  });

  it('creates a role through the service', async () => {
    const user = { userId: 'user-1' };
    const dto = { name: 'admin' };
    rolesService.createRole.mockResolvedValueOnce({ id: 'role-1' });

    await expect(controller.create(user as any, dto as any)).resolves.toEqual({ id: 'role-1' });
    expect(rolesService.createRole).toHaveBeenCalledWith(user, dto);
  });

  it('lists roles through the service', async () => {
    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
    rolesService.listRoles.mockResolvedValueOnce({ data: [] });

    await expect(controller.list({ userId: 'user-1' } as any, query as any)).resolves.toEqual({
      data: [],
    });
    expect(rolesService.listRoles).toHaveBeenCalledWith({ userId: 'user-1' }, query);
  });

  it('gets a role by id through the service', async () => {
    rolesService.getRoleById.mockResolvedValueOnce({ id: 'role-1' });

    await expect(controller.getById({ userId: 'user-1' } as any, 'role-1')).resolves.toEqual({
      id: 'role-1',
    });
    expect(rolesService.getRoleById).toHaveBeenCalledWith({ userId: 'user-1' }, 'role-1');
  });
});
