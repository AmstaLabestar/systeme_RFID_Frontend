import { Test } from '@nestjs/testing';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const usersService = {
    createUser: jest.fn(),
    listUsers: jest.fn(),
    getUserById: jest.fn(),
  };

  let controller: UsersController;
  const allowGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
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

    controller = moduleRef.get(UsersController);
  });

  it('creates a user through the service', async () => {
    const user = { userId: 'actor-1' };
    const dto = { email: 'alice@example.com' };
    usersService.createUser.mockResolvedValueOnce({ id: 'user-1' });

    await expect(controller.create(user as any, dto as any)).resolves.toEqual({ id: 'user-1' });
    expect(usersService.createUser).toHaveBeenCalledWith(user, dto);
  });

  it('lists users through the service', async () => {
    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
    usersService.listUsers.mockResolvedValueOnce({ data: [] });

    await expect(controller.list({ userId: 'actor-1' } as any, query as any)).resolves.toEqual({
      data: [],
    });
    expect(usersService.listUsers).toHaveBeenCalledWith({ userId: 'actor-1' }, query);
  });

  it('gets a user by id through the service', async () => {
    usersService.getUserById.mockResolvedValueOnce({ id: 'user-1' });

    await expect(controller.getById({ userId: 'actor-1' } as any, 'user-1')).resolves.toEqual({
      id: 'user-1',
    });
    expect(usersService.getUserById).toHaveBeenCalledWith({ userId: 'actor-1' }, 'user-1');
  });
});
