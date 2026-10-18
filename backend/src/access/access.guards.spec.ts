import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from './access.service';
import {
  RestaurantScopeGuard,
  SchoolScopeGuard,
  SystemAdminGuard,
} from './access.guards';
import { RESTAURANT_SCOPE_KEY, SCHOOL_SCOPE_KEY } from './access.constants';
import { RolesGuard } from '../guards/roles.guard';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/role.decorator';

const ctxFor = (req: any): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => function handler() {},
    getClass: () => class Ctl {},
  }) as any;

const reflectorWith = (meta: Record<string, any>) =>
  ({
    getAllAndOverride: jest.fn((key: string) => meta[key]),
  }) as unknown as Reflector;

/** AccessService backed by a mocked Prisma so the aal / role logic is the real one. */
const accessFor = (userRow: any, extra: any = {}) => {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(userRow) },
    restaurant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ restaurantId: 'r1', canteen: { schoolId: 's1' } }),
    },
    menu: { findUnique: jest.fn().mockResolvedValue({ restaurantId: 'r1' }) },
    order: { findUnique: jest.fn().mockResolvedValue({ restaurantId: 'r1' }) },
    ...extra,
  };
  return new AccessService(prisma);
};

const adminRow = {
  role: 'ADMIN',
  schoolId: null,
  schoolMemberships: [],
  restaurantMemberships: [],
};
const userRow = (over: any = {}) => ({
  role: 'USER',
  schoolId: 's1',
  schoolMemberships: [],
  restaurantMemberships: [],
  ...over,
});

describe('SystemAdminGuard', () => {
  it('rejects ADMIN with aal1', async () => {
    const guard = new SystemAdminGuard(accessFor(adminRow));
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'a', role: 'ADMIN', aal: 'aal1' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects ADMIN with no aal claim', async () => {
    const guard = new SystemAdminGuard(accessFor(adminRow));
    await expect(
      guard.canActivate(ctxFor({ user: { userId: 'a', role: 'ADMIN' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts ADMIN with aal2', async () => {
    const guard = new SystemAdminGuard(accessFor(adminRow));
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'a', role: 'ADMIN', aal: 'aal2' } }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects a non-admin even with aal2', async () => {
    const guard = new SystemAdminGuard(accessFor(userRow()));
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u', role: 'USER', aal: 'aal2' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not trust role on req.user (DB decides)', async () => {
    const guard = new SystemAdminGuard(accessFor(userRow()));
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u', role: 'ADMIN', aal: 'aal2' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('401 when unauthenticated', async () => {
    const guard = new SystemAdminGuard(accessFor(adminRow));
    await expect(guard.canActivate(ctxFor({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('SchoolScopeGuard', () => {
  const reflector = reflectorWith({ [SCHOOL_SCOPE_KEY]: 'schoolId' });

  it('allows admin of the school', async () => {
    const guard = new SchoolScopeGuard(
      reflector,
      accessFor(userRow({ schoolMemberships: [{ schoolId: 's1' }] })),
    );
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { schoolId: 's1' } }),
      ),
    ).resolves.toBe(true);
  });

  it('blocks admin of a different school', async () => {
    const guard = new SchoolScopeGuard(
      reflector,
      accessFor(userRow({ schoolMemberships: [{ schoolId: 's1' }] })),
    );
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { schoolId: 's2' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks plain student and missing param', async () => {
    const guard = new SchoolScopeGuard(reflector, accessFor(userRow()));
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { schoolId: 's1' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(ctxFor({ user: { userId: 'u' }, params: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('system admin aal2 passes, aal1 does not', async () => {
    const guard = new SchoolScopeGuard(reflector, accessFor(adminRow));
    await expect(
      guard.canActivate(
        ctxFor({
          user: { userId: 'a', aal: 'aal2' },
          params: { schoolId: 's9' },
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        ctxFor({
          user: { userId: 'a', aal: 'aal1' },
          params: { schoolId: 's9' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('RestaurantScopeGuard', () => {
  const owner = { roles: ['OWNER'], param: 'restaurantId' };
  const guardFor = (opts: any, row: any, extra?: any) =>
    new RestaurantScopeGuard(
      reflectorWith({ [RESTAURANT_SCOPE_KEY]: opts }),
      accessFor(row, extra),
    );

  it('allows OWNER and records the resolved restaurantId', async () => {
    const req: any = { user: { userId: 'u' }, params: { restaurantId: 'r1' } };
    const guard = guardFor(
      owner,
      userRow({
        restaurantMemberships: [{ restaurantId: 'r1', role: 'OWNER' }],
      }),
    );
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.restaurantId).toBe('r1');
  });

  it('blocks STAFF on owner-only route', async () => {
    const guard = guardFor(
      owner,
      userRow({
        restaurantMemberships: [{ restaurantId: 'r1', role: 'STAFF' }],
      }),
    );
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { restaurantId: 'r1' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves menuId and orderId params to the restaurant', async () => {
    const row = userRow({
      restaurantMemberships: [{ restaurantId: 'r1', role: 'STAFF' }],
    });
    const menuGuard = guardFor(
      { param: 'menuId', roles: ['OWNER', 'STAFF'] },
      row,
    );
    await expect(
      menuGuard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { menuId: 'm1' } }),
      ),
    ).resolves.toBe(true);
    const orderGuard = guardFor(
      { param: 'orderId', roles: ['OWNER', 'STAFF'] },
      row,
    );
    await expect(
      orderGuard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { orderId: 'o1' } }),
      ),
    ).resolves.toBe(true);
  });

  it('404 for unknown resource', async () => {
    const guard = guardFor({ param: 'menuId', roles: ['OWNER'] }, userRow(), {
      menu: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      guard.canActivate(
        ctxFor({ user: { userId: 'u' }, params: { menuId: 'nope' } }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('school admin passes only with allowSchoolAdmin', async () => {
    const row = userRow({ schoolMemberships: [{ schoolId: 's1' }] });
    const req = () =>
      ctxFor({ user: { userId: 'u' }, params: { restaurantId: 'r1' } });
    await expect(
      guardFor(owner, row).canActivate(req()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guardFor({ ...owner, allowSchoolAdmin: true }, row).canActivate(req()),
    ).resolves.toBe(true);
  });

  it('system admin aal1 is rejected', async () => {
    const guard = guardFor(owner, adminRow);
    await expect(
      guard.canActivate(
        ctxFor({
          user: { userId: 'a', aal: 'aal1' },
          params: { restaurantId: 'r1' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(
        ctxFor({
          user: { userId: 'a', aal: 'aal2' },
          params: { restaurantId: 'r1' },
        }),
      ),
    ).resolves.toBe(true);
  });
});

describe('RolesGuard', () => {
  it('passes @Public and routes without roles', () => {
    expect(
      new RolesGuard(
        reflectorWith({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: ['ADMIN'] }),
      ).canActivate(ctxFor({})),
    ).toBe(true);
    expect(
      new RolesGuard(reflectorWith({})).canActivate(
        ctxFor({ user: { role: 'USER' } }),
      ),
    ).toBe(true);
  });

  it('allows a listed role', () => {
    expect(
      new RolesGuard(reflectorWith({ [ROLES_KEY]: ['ADMIN'] })).canActivate(
        ctxFor({ user: { role: 'ADMIN' } }),
      ),
    ).toBe(true);
  });

  it('throws Forbidden for an unlisted role or no user', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ['ADMIN'] }));
    expect(() => guard.canActivate(ctxFor({ user: { role: 'USER' } }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(ctxFor({}))).toThrow(ForbiddenException);
  });
});

describe('SupabaseAuthGuard', () => {
  const build = (identity: any, meta: Record<string, any> = {}) => {
    const supabase: any = {
      verifyAccessToken: jest.fn().mockResolvedValue(identity),
      resolveUser: jest
        .fn()
        .mockResolvedValue({ userId: 'u1', email: 'e@x.com', role: 'USER' }),
    };
    return {
      guard: new SupabaseAuthGuard(reflectorWith(meta), supabase),
      supabase,
    };
  };

  it('puts the aal claim on req.user', async () => {
    const { guard } = build({
      id: 'u1',
      email: 'e@x.com',
      name: 'n',
      aal: 'aal2',
    });
    const req: any = { headers: { authorization: 'Bearer tok' } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.user).toEqual({
      userId: 'u1',
      email: 'e@x.com',
      role: 'USER',
      aal: 'aal2',
    });
  });

  it('401 without a token unless @Public', async () => {
    await expect(
      build(null).guard.canActivate(ctxFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      build(null, { [IS_PUBLIC_KEY]: true }).guard.canActivate(
        ctxFor({ headers: {} }),
      ),
    ).resolves.toBe(true);
  });

  it('401 for an invalid token', async () => {
    await expect(
      build(null).guard.canActivate(
        ctxFor({ headers: { authorization: 'Bearer bad' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
