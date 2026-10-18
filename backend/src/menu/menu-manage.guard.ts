import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccessService } from '../access';

/** "May manage menus" (owner/admin/staff of some shop, or sysadmin), checked before multer buffers the upload. */
@Injectable()
export class MenuManageGuard implements CanActivate {
  constructor(private readonly access: AccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    await this.access.assertCanManageMenus(req.user, req);
    return true;
  }
}
