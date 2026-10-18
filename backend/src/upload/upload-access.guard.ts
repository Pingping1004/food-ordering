import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccessService } from '../access';

/** Image upload permission, checked before multer starts buffering the request body. */
@Injectable()
export class UploadAccessGuard implements CanActivate {
  constructor(private readonly access: AccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    await this.access.assertCanUpload(req.user, req);
    return true;
  }
}
