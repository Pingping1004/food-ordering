import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from '../access/access.service';
import {
  RestaurantScopeGuard,
  SchoolScopeGuard,
} from '../access/access.guards';
import {
  RESTAURANT_SCOPE_KEY,
  SCHOOL_SCOPE_KEY,
} from '../access/access.constants';
import {
  RestaurantRefundController,
  SchoolRefundController,
} from './refund.controller';

/** Runs the real guards with the metadata declared on the refund routes. */
const ctxFor = (req: any, handler: object, cls: object): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as any;

const accessFor = (userRow: any) =>
  new AccessService({
    user: { findUnique: jest.fn().mockResolvedValue(userRow) },
    restaurant: {
      findUnique: jest.fn().mockResolvedValue({
        restaurantId: 'r1',
        status: 'ACTIVE',
        canteen: { schoolId: 's1', school: { status: 'ACTIVE' } },
      }),
    },
  } as any);

const userRow = (over: any = {}) => ({
  role: 'USER',
  schoolId: 's1',
  schoolMemberships: [],
  restaurantMemberships: [],
  ...over,
});
const member = (role: string, restaurantId = 'r1') =>
  userRow({ restaurantMemberships: [{ restaurantId, role }] });
const schoolAdmin = userRow({ schoolMemberships: [{ schoolId: 's1' }] });

const shop = RestaurantRefundController.prototype as any;
const school = SchoolRefundController.prototype as any;

const shopRoute = (handler: object, row: any, method: string) =>
  new RestaurantScopeGuard(new Reflector(), accessFor(row)).canActivate(
    ctxFor(
      { method, user: { userId: 'u' }, params: { restaurantId: 'r1' } },
      handler,
      RestaurantRefundController,
    ),
  );

describe('Refund route permissions', () => {
  it('shop OWNER and ADMIN may decide', async () => {
    for (const role of ['OWNER', 'ADMIN'])
      await expect(shopRoute(shop.decide, member(role), 'PATCH')).resolves.toBe(
        true,
      );
  });

  it('shop STAFF may read but not decide', async () => {
    await expect(shopRoute(shop.list, member('STAFF'), 'GET')).resolves.toBe(
      true,
    );
    await expect(
      shopRoute(shop.decide, member('STAFF'), 'PATCH'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a manager of another restaurant cannot decide', async () => {
    await expect(
      shopRoute(shop.decide, member('OWNER', 'r2'), 'PATCH'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('school admin: 403 on decide, allowed on the shop list and the school list', async () => {
    await expect(
      shopRoute(shop.decide, schoolAdmin, 'PATCH'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(shopRoute(shop.list, schoolAdmin, 'GET')).resolves.toBe(true);

    const guard = new SchoolScopeGuard(new Reflector(), accessFor(schoolAdmin));
    for (const handler of [school.list, school.summary, school.get])
      await expect(
        guard.canActivate(
          ctxFor(
            {
              method: 'GET',
              user: { userId: 'u' },
              params: { schoolId: 's1' },
            },
            handler,
            SchoolRefundController,
          ),
        ),
      ).resolves.toBe(true);
    expect(school.decide).toBeUndefined();
    expect(Reflect.getMetadata(SCHOOL_SCOPE_KEY, school.list)).toBe('schoolId');
  });

  it('a student with no membership gets 403 / 404, never through', async () => {
    const err = await shopRoute(shop.decide, userRow(), 'PATCH').catch(
      (e) => e,
    );
    expect(
      err instanceof ForbiddenException || err instanceof NotFoundException,
    ).toBe(true);
    expect(
      Reflect.getMetadata(RESTAURANT_SCOPE_KEY, shop.decide).roles,
    ).toEqual(['OWNER', 'ADMIN']);
  });
});
