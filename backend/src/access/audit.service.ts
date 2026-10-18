import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditActorRole = 'SYSADMIN' | 'SCHOOL_ADMIN' | 'USER';

export interface AuditEntry {
  /** Express request: supplies actor, method and path, and marks the request as already audited. */
  req?: any;
  actorId?: string | null;
  actorRole?: AuditActorRole;
  schoolId?: string | null;
  action: string;
  method?: string;
  path?: string;
  entityType?: string | null;
  entityId?: string | null;
  reason?: string | null;
  supportGrantId?: string | null;
  meta?: Record<string, unknown> | null;
}

export const AUDIT_DEFAULT_LIMIT = 30;
export const AUDIT_MAX_LIMIT = 100;

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(private readonly prisma: PrismaService) {}

  /** Best effort: an audit failure is logged but never breaks the request that triggered it. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const req = entry.req;
      if (req) req.auditRecorded = true;
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? req?.user?.userId ?? null,
          actorRole: entry.actorRole ?? 'SYSADMIN',
          schoolId: entry.schoolId ?? null,
          action: entry.action,
          method: entry.method ?? req?.method ?? 'SYSTEM',
          path:
            entry.path ??
            String(req?.originalUrl ?? req?.url ?? '').split('?')[0],
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          reason: entry.reason ?? null,
          supportGrantId:
            entry.supportGrantId ?? req?.sysadminAudit?.grantId ?? null,
          meta: (entry.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err as Error);
    }
  }

  /** Cursor-paginated trail of ONE school. Never returns rows of other schools. */
  async listForSchool(
    schoolId: string,
    opts: { cursor?: string; limit?: number; actor?: 'sysadmin' } = {},
  ) {
    const limit = Math.min(
      Math.max(
        Math.trunc(opts.limit ?? AUDIT_DEFAULT_LIMIT) || AUDIT_DEFAULT_LIMIT,
        1,
      ),
      AUDIT_MAX_LIMIT,
    );
    const rows = await this.prisma.auditLog.findMany({
      where: {
        schoolId,
        ...(opts.actor === 'sysadmin' ? { actorRole: 'SYSADMIN' } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: { actor: { select: { userId: true, name: true } } },
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        actor: {
          userId: r.actor?.userId ?? r.actorId,
          name: r.actor?.name ?? null,
          role: r.actorRole,
        },
        action: r.action,
        method: r.method,
        path: r.path,
        entityType: r.entityType,
        entityId: r.entityId,
        reason: r.reason,
        supportGrantId: r.supportGrantId,
        meta: r.meta ?? null,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }
}
