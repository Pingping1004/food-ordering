import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  RESTAURANT_SCOPE_KEY,
  SYSADMIN_WRITE_KEY,
  SCHOOL_SCOPE_KEY,
  RestaurantScopeOptions,
} from './access.constants';
import {
  SystemAdminGuard,
  SchoolScopeGuard,
  RestaurantScopeGuard,
} from './access.guards';

/** Role ADMIN in the DB **and** an aal2 (TOTP) session. */
export const SystemAdmin = () => applyDecorators(UseGuards(SystemAdminGuard));

/** System admin, or approved admin of the school whose id is in route param `param`. */
export const SchoolScope = (param = 'schoolId') =>
  applyDecorators(
    SetMetadata(SCHOOL_SCOPE_KEY, param),
    UseGuards(SchoolScopeGuard),
  );

/** System admin, or an approved member of the restaurant (see options). */
export const RestaurantScope = (options: RestaurantScopeOptions) =>
  applyDecorators(
    SetMetadata(RESTAURANT_SCOPE_KEY, options),
    UseGuards(RestaurantScopeGuard),
  );

/**
 * Marks a handler as a platform operation the system admin may perform without a support grant
 * (create school, SCHOOL_ADMIN codes, school status, payouts, support grants). Always audited.
 * Without it a sysadmin is read-only on school-scoped routes.
 */
export const SysadminWrite = () => SetMetadata(SYSADMIN_WRITE_KEY, true);
