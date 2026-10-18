import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AccessService } from './access.service';
import { AuditService } from './audit.service';
import { SysadminAuditInterceptor } from './sysadmin-audit.interceptor';
import {
  RestaurantScopeGuard,
  SchoolScopeGuard,
  SystemAdminGuard,
} from './access.guards';

@Global()
@Module({
  providers: [
    AccessService,
    AuditService,
    SystemAdminGuard,
    SchoolScopeGuard,
    RestaurantScopeGuard,
    SysadminAuditInterceptor,
    { provide: APP_INTERCEPTOR, useClass: SysadminAuditInterceptor },
  ],
  exports: [
    AccessService,
    AuditService,
    SystemAdminGuard,
    SchoolScopeGuard,
    RestaurantScopeGuard,
  ],
})
export class AccessModule {}
