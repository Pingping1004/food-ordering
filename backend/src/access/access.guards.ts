import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from './access.service';
import {
  RESTAURANT_SCOPE_KEY,
  SCHOOL_SCOPE_KEY,
  SYSADMIN_WRITE_KEY,
  RestaurantScopeOptions,
} from './access.constants';

/** Copies the `@SysadminWrite()` marker onto the request so AccessService.assert* can see it. */
function markSysadminWrite(
  reflector: Reflector | undefined,
  context: ExecutionContext,
  req: any,
) {
  req.sysadminWrite =
    !!reflector?.getAllAndOverride<boolean>(SYSADMIN_WRITE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
}

function getRequest(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest();
  if (!req.user?.userId) throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
  return req;
}

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(
    private readonly access: AccessService,
    private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getRequest(context);
    await this.access.assertSystemAdmin(req.user, req);
    markSysadminWrite(this.reflector, context, req);
    // Writes under /admin/schools/:schoolId/... are school writes: marked handlers or a support grant only.
    if (req.params?.schoolId)
      await this.access.enforceSysadminPolicy(
        req.user,
        req.params.schoolId,
        req,
      );
    return true;
  }
}

@Injectable()
export class SchoolScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getRequest(context);
    const param = this.reflector.getAllAndOverride<string>(SCHOOL_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const schoolId = req.params?.[param];
    if (!schoolId) throw new ForbiddenException('ไม่พบรหัสโรงเรียน');
    markSysadminWrite(this.reflector, context, req);
    await this.access.assertSchoolAdmin(req.user, schoolId, req);
    return true;
  }
}

@Injectable()
export class RestaurantScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getRequest(context);
    const opts = this.reflector.getAllAndOverride<RestaurantScopeOptions>(
      RESTAURANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const id = req.params?.[opts.param];
    if (!id) throw new NotFoundException('ไม่พบข้อมูล');
    markSysadminWrite(this.reflector, context, req);

    const restaurantId = await this.access.resolveRestaurantId(
      opts.param.startsWith('menu')
        ? { menuId: id }
        : opts.param.startsWith('order')
          ? { orderId: id }
          : { restaurantId: id },
    );
    try {
      await this.access.assertRestaurantRole(
        req.user,
        restaurantId,
        opts.roles,
        {
          allowSchoolAdmin: opts.allowSchoolAdmin,
          cacheKey: req,
        },
      );
    } catch (err) {
      if (err instanceof ForbiddenException)
        await this.hideOtherSchools(req, restaurantId);
      throw err;
    }
    req.restaurantId = restaurantId;
    return true;
  }

  /** A restaurant the caller cannot even see (other school, not a member) must look non-existent: 404, not 403. */
  private async hideOtherSchools(
    req: any,
    restaurantId: string,
  ): Promise<void> {
    try {
      await this.access.hideInvisibleRestaurant(req.user, restaurantId, req);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
    }
  }
}
