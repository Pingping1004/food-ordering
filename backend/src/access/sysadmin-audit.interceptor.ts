import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const ENTITY_PARAMS: [string, string][] = [
  ['refundId', 'REFUND_REQUEST'],
  ['id', 'ENTITY'],
  ['memberId', 'MEMBERSHIP'],
  ['codeId', 'INVITE_CODE'],
  ['canteenId', 'CANTEEN'],
  ['restaurantId', 'RESTAURANT'],
  ['menuId', 'MENU'],
  ['orderId', 'ORDER'],
];

const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/** Id of a freshly created entity, read from the response body (creates have no id in the route). */
const idFromBody = (body: any): [string, string] | null => {
  if (!body || typeof body !== 'object') return null;
  for (const [key, type] of [
    ['canteenId', 'CANTEEN'],
    ['restaurantId', 'RESTAURANT'],
    ['menuId', 'MENU'],
    ['id', 'ENTITY'],
  ] as const)
    if (body[key]) return [type, String(body[key])];
  return null;
};

/**
 * Writes an AuditLog row for every non-GET request that went through a school-scoped guard as
 * a system admin (`req.sysadminAudit`, set by AccessService.enforceSysadminPolicy) or as a school admin
 * (`req.schoolAdminAudit`): every create, update and delete, successful or rejected.
 * Handlers that already wrote a richer row (`req.auditRecorded`) are skipped.
 */
@Injectable()
export class SysadminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap({
        next: (body) => this.log(req, 200, body),
        error: (err) => this.log(req, err?.status ?? 500),
      }),
    );
  }

  private log(req: any, statusCode: number, body?: unknown) {
    const sys = req?.sysadminAudit;
    const admin = req?.schoolAdminAudit;
    const a = sys ?? admin;
    if (!a || req.auditRecorded) return;
    const params = req.params ?? {};
    const hit = ENTITY_PARAMS.find(([key]) => params[key]);
    const created = hit ? null : idFromBody(body);
    const verb = METHOD_ACTION[String(req.method).toUpperCase()] ?? 'WRITE';
    void this.audit.record({
      req,
      actorRole: sys ? 'SYSADMIN' : 'SCHOOL_ADMIN',
      schoolId: a.schoolId,
      action: sys ? 'SYSADMIN_WRITE' : `SCHOOL_ADMIN_${verb}`,
      supportGrantId: sys ? a.grantId : null,
      entityType: hit?.[1] ?? created?.[0] ?? null,
      entityId: hit ? String(params[hit[0]]) : (created?.[1] ?? null),
      meta: { statusCode },
    });
  }
}
