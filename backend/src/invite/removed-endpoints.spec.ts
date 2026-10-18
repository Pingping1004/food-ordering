import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { MeSchoolController } from '../school/me-school.controller';
import { SchoolsController } from '../school/schools.controller';
import { AdminSchoolsController } from '../school/admin-schools.controller';
import { SchoolService } from '../school/school.service';
import { RestaurantController } from '../restaurant/restaurant.controller';
import { RestaurantService } from '../restaurant/restaurant.service';
import { MeCodesController } from './me-codes.controller';
import {
  RESTAURANT_SCOPE_KEY,
  SCHOOL_SCOPE_KEY,
} from '../access/access.constants';

/** "METHOD base/path" for every routed handler of a controller. */
const routes = (ctrl: any) => {
  const base = Reflect.getMetadata(PATH_METADATA, ctrl) ?? '';
  const proto = ctrl.prototype;
  return Object.getOwnPropertyNames(proto)
    .filter(
      (n) =>
        n !== 'constructor' &&
        Reflect.getMetadata(METHOD_METADATA, proto[n]) !== undefined,
    )
    .map((n) => {
      const method = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'][
        Reflect.getMetadata(METHOD_METADATA, proto[n])
      ];
      const sub = Reflect.getMetadata(PATH_METADATA, proto[n]);
      return {
        name: n,
        route: `${method} /${[base, sub === '/' ? '' : sub].filter(Boolean).join('/')}`,
        handler: proto[n],
      };
    });
};

describe('bypass endpoints are gone', () => {
  const all = [
    MeSchoolController,
    SchoolsController,
    AdminSchoolsController,
    RestaurantController,
    MeCodesController,
  ].flatMap((c) => routes(c).map((r) => r.route));

  it('no join / admin-request / join-request routes', () => {
    expect(all).not.toContain('POST /me/school/join');
    expect(all).not.toContain('POST /me/school/admin-request');
    expect(all.some((r) => r.includes('join-request'))).toBe(false);
    expect(all.some((r) => r.includes('admin-request'))).toBe(false);
  });

  it('school application endpoints are gone; sysadmin create exists', () => {
    expect(all).not.toContain('POST /schools/apply');
    expect(
      all.some((r) => /approve|reject/.test(r) && r.includes('/admin/schools')),
    ).toBe(false);
    expect(all).toContain('POST /admin/schools');
    expect((SchoolService.prototype as any).applyForSchool).toBeUndefined();
    expect((SchoolService.prototype as any).approveSchool).toBeUndefined();
    expect((SchoolService.prototype as any).rejectSchool).toBeUndefined();
  });

  it('services no longer expose the bypass methods', () => {
    expect((SchoolService.prototype as any).requestSchoolAdmin).toBeUndefined();
    expect((RestaurantService.prototype as any).requestToJoin).toBeUndefined();
  });

  it('the redeem route exists and the change-school route stays', () => {
    expect(all).toContain('POST /me/redeem-code');
    expect(all).toContain('PATCH /me/school');
  });
});

describe('code management routes are scoped', () => {
  it('school codes need SchoolScope; sysadmin mirror needs SystemAdmin; staff codes need owner scope', () => {
    for (const r of routes(SchoolsController).filter((x) =>
      x.route.includes('/codes'),
    )) {
      expect(Reflect.getMetadata(SCHOOL_SCOPE_KEY, r.handler)).toBe('schoolId');
    }
    expect(
      routes(SchoolsController).filter((x) => x.route.includes('/codes')),
    ).toHaveLength(4);

    expect(
      routes(AdminSchoolsController).filter((x) => x.route.includes('/codes')),
    ).toHaveLength(4);
    expect(
      Reflect.getMetadata('__guards__', AdminSchoolsController),
    ).toBeDefined();

    const staff = routes(RestaurantController).filter((x) =>
      x.route.includes('/staff-codes'),
    );
    expect(staff).toHaveLength(4);
    for (const r of staff) {
      expect(
        Reflect.getMetadata(RESTAURANT_SCOPE_KEY, r.handler),
      ).toMatchObject({ param: 'restaurantId', roles: ['OWNER'] });
    }
  });
});
