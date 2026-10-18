import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, lastValueFrom } from 'rxjs';
import { AccessService } from './access.service';
import {
  RestaurantScopeGuard,
  SchoolScopeGuard,
  SystemAdminGuard,
} from './access.guards';
import {
  RESTAURANT_SCOPE_KEY,
  SCHOOL_SCOPE_KEY,
  SYSADMIN_WRITE_KEY,
} from './access.constants';
import { AuditService } from './audit.service';
import { SysadminAuditInterceptor } from './sysadmin-audit.interceptor';

const ctxFor = (req: any): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => function handler() {},
    getClass: () => class Ctl {},
  }) as any;

const reflectorWith = (meta: Record<string, any>) =>
  ({
    getAllAndOverride: jest.fn((key: string) => meta[key]),
  }) as unknown as Reflector;

const adminRow = {
  role: 'ADMIN',
  schoolId: null,
  schoolMemberships: [],
  restaurantMemberships: [],
};

const makePrisma = (over: any = {}) => ({
  user: { findUnique: jest.fn().mockResolvedValue(adminRow) },
  restaurant: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ restaurantId: 'r1', canteen: { schoolId: 's1' } }),
  },
  supportGrant: { findFirst: jest.fn().mockResolvedValue(null) },
  ...over,
});

const sysadminReq = (method: string, extra: any = {}) => ({
  method,
  params: { schoolId: 's1' },
  user: { userId: 'a1', role: 'ADMIN', aal: 'aal2' },
  ...extra,
});

describe('system admin is read-only on school-scoped routes', () => {
  const schoolGuard = (prisma: any, meta: any = {}) =>
    new SchoolScopeGuard(
      reflectorWith({ [SCHOOL_SCOPE_KEY]: 'schoolId', ...meta }),
      new AccessService(prisma),
    );

  it.each(['GET', 'HEAD'])('%s passes with no grant', async (method) => {
    const prisma = makePrisma();
    await expect(
      schoolGuard(prisma).canActivate(ctxFor(sysadminReq(method))),
    ).resolves.toBe(true);
    expect(prisma.supportGrant.findFirst).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    '%s is denied with SYSADMIN_READ_ONLY when there is no grant',
    async (method) => {
      const err: any = await schoolGuard(makePrisma())
        .canActivate(ctxFor(sysadminReq(method)))
        .catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().code).toBe('SYSADMIN_READ_ONLY');
    },
  );

  it('a @SysadminWrite handler is allowed and flagged for audit (no grant lookup)', async () => {
    const prisma = makePrisma();
    const req: any = sysadminReq('POST');
    await expect(
      schoolGuard(prisma, { [SYSADMIN_WRITE_KEY]: true }).canActivate(
        ctxFor(req),
      ),
    ).resolves.toBe(true);
    expect(prisma.supportGrant.findFirst).not.toHaveBeenCalled();
    expect(req.sysadminAudit).toEqual({ schoolId: 's1', grantId: null });
  });

  it('an active support grant allows the write and records the grant id', async () => {
    const prisma = makePrisma();
    prisma.supportGrant.findFirst.mockResolvedValue({ id: 'g1' });
    const req: any = sysadminReq('PATCH');
    await expect(schoolGuard(prisma).canActivate(ctxFor(req))).resolves.toBe(
      true,
    );
    expect(req.sysadminAudit).toEqual({ schoolId: 's1', grantId: 'g1' });
    const where = prisma.supportGrant.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      adminId: 'a1',
      schoolId: 's1',
      revokedAt: null,
    });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('an expired or revoked grant is not found by the query, so the write is denied again', async () => {
    const prisma = makePrisma();
    prisma.supportGrant.findFirst
      .mockResolvedValueOnce({ id: 'g1' })
      .mockResolvedValueOnce(null); // grant expired / revoked afterwards
    const guard = schoolGuard(prisma);
    await expect(guard.canActivate(ctxFor(sysadminReq('POST')))).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(ctxFor(sysadminReq('POST'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a grant is looked up per school (grant of another school does not help)', async () => {
    const prisma = makePrisma();
    await schoolGuard(prisma)
      .canActivate(ctxFor(sysadminReq('POST', { params: { schoolId: 's2' } })))
      .catch(() => undefined);
    expect(prisma.supportGrant.findFirst.mock.calls[0][0].where.schoolId).toBe(
      's2',
    );
  });

  it('a sysadmin who is also an approved admin of the school writes through the membership', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      ...adminRow,
      schoolMemberships: [{ schoolId: 's1' }],
    });
    await expect(
      schoolGuard(prisma).canActivate(ctxFor(sysadminReq('POST'))),
    ).resolves.toBe(true);
    expect(prisma.supportGrant.findFirst).not.toHaveBeenCalled();
  });

  it('restaurant scope: sysadmin GET passes, write needs a grant on the restaurant school', async () => {
    const prisma = makePrisma();
    const guard = new RestaurantScopeGuard(
      reflectorWith({
        [RESTAURANT_SCOPE_KEY]: { param: 'restaurantId', roles: ['OWNER'] },
      }),
      new AccessService(prisma as any),
    );
    const base = { params: { restaurantId: 'r1' } };
    await expect(
      guard.canActivate(ctxFor(sysadminReq('GET', base))),
    ).resolves.toBe(true);
    const err: any = await guard
      .canActivate(ctxFor(sysadminReq('PATCH', base)))
      .catch((e) => e);
    expect(err.getResponse().code).toBe('SYSADMIN_READ_ONLY');
    expect(prisma.supportGrant.findFirst.mock.calls[0][0].where.schoolId).toBe(
      's1',
    );
  });

  it('@SystemAdmin route with :schoolId (e.g. student-code rotate) needs a grant; marked ones do not', async () => {
    const prisma = makePrisma();
    const access = new AccessService(prisma as any);
    const unmarked = new SystemAdminGuard(access, reflectorWith({}));
    const err: any = await unmarked
      .canActivate(ctxFor(sysadminReq('POST')))
      .catch((e) => e);
    expect(err.getResponse().code).toBe('SYSADMIN_READ_ONLY');

    const marked = new SystemAdminGuard(
      access,
      reflectorWith({ [SYSADMIN_WRITE_KEY]: true }),
    );
    await expect(
      marked.canActivate(ctxFor(sysadminReq('PATCH'))),
    ).resolves.toBe(true);

    // platform route without :schoolId (create school / payouts) is not restricted
    await expect(
      unmarked.canActivate(ctxFor(sysadminReq('POST', { params: {} }))),
    ).resolves.toBe(true);
  });
});

describe('audit trail', () => {
  it('interceptor writes one row per sysadmin write with the grant id (success and failure)', async () => {
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new SysadminAuditInterceptor(audit as any);
    const req: any = {
      method: 'PATCH',
      params: { schoolId: 's1', restaurantId: 'r9' },
      sysadminAudit: { schoolId: 's1', grantId: 'g1' },
    };
    await lastValueFrom(
      interceptor.intercept(ctxFor(req), { handle: () => of('ok') }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: 's1',
        action: 'SYSADMIN_WRITE',
        supportGrantId: 'g1',
        entityType: 'RESTAURANT',
        entityId: 'r9',
        actorRole: 'SYSADMIN',
      }),
    );

    audit.record.mockClear();
    await lastValueFrom(
      interceptor.intercept(ctxFor(req), {
        handle: () => throwError(() => ({ status: 409 })),
      }),
    ).catch(() => undefined);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { statusCode: 409 } }),
    );
  });

  it('interceptor skips plain requests and handlers that already audited', async () => {
    const audit = { record: jest.fn() };
    const interceptor = new SysadminAuditInterceptor(audit as any);
    await lastValueFrom(
      interceptor.intercept(ctxFor({ method: 'POST', params: {} }), {
        handle: () => of(1),
      }),
    );
    await lastValueFrom(
      interceptor.intercept(
        ctxFor({
          method: 'POST',
          params: {},
          sysadminAudit: { schoolId: 's1', grantId: null },
          auditRecorded: true,
        }),
        { handle: () => of(1) },
      ),
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('AuditService.record writes the row and marks the request as audited; failures never throw', async () => {
    const prisma: any = {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const svc = new AuditService(prisma);
    const req: any = {
      method: 'DELETE',
      originalUrl: '/api/schools/s1/x?y=1',
      user: { userId: 'a1' },
      sysadminAudit: { schoolId: 's1', grantId: 'g1' },
    };
    await svc.record({ req, schoolId: 's1', action: 'X', reason: 'why' });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      actorId: 'a1',
      actorRole: 'SYSADMIN',
      schoolId: 's1',
      method: 'DELETE',
      path: '/api/schools/s1/x',
      supportGrantId: 'g1',
      reason: 'why',
    });
    expect(req.auditRecorded).toBe(true);

    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    await expect(svc.record({ action: 'Y' })).resolves.toBeUndefined();
  });

  it('listForSchool only queries the given school, filters by actor and paginates', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `l${i}`,
      createdAt: new Date(),
      actorId: 'a1',
      actor: { userId: 'a1', name: 'Admin' },
      actorRole: 'SYSADMIN',
      action: 'SYSADMIN_WRITE',
      method: 'POST',
      path: '/p',
      entityType: null,
      entityId: null,
      reason: null,
      supportGrantId: 'g1',
      meta: null,
    }));
    const prisma: any = {
      auditLog: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    const res = await new AuditService(prisma).listForSchool('s1', {
      limit: 2,
      actor: 'sysadmin',
      cursor: 'c0',
    });
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ schoolId: 's1', actorRole: 'SYSADMIN' });
    expect(args.take).toBe(3);
    expect(args.cursor).toEqual({ id: 'c0' });
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('l1');
    expect(res.items[0].actor).toEqual({
      userId: 'a1',
      name: 'Admin',
      role: 'SYSADMIN',
    });
  });

  it('a school admin of another school cannot reach the audit log (scope guard 403)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      role: 'USER',
      schoolId: 's2',
      schoolMemberships: [{ schoolId: 's2' }],
      restaurantMemberships: [],
    });
    const guard = new SchoolScopeGuard(
      reflectorWith({ [SCHOOL_SCOPE_KEY]: 'schoolId' }),
      new AccessService(prisma as any),
    );
    await expect(
      guard.canActivate(
        ctxFor({
          method: 'GET',
          params: { schoolId: 's1' },
          user: { userId: 'u2', role: 'USER' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
