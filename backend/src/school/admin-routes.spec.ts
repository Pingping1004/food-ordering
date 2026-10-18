import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminSchoolsController } from './admin-schools.controller';
import { SchoolsController } from './schools.controller';
import { SchoolService } from './school.service';
import { SchoolStatusDto } from './dto/school.dto';
import { SupportGrantController } from '../support-grant/support-grant.controller';
import { PayoutController } from '../payout/payout.controller';
import { SYSADMIN_WRITE_KEY } from '../access/access.constants';
import { AccessService } from '../access/access.service';

const marked = (proto: any, name: string) =>
  Reflect.getMetadata(SYSADMIN_WRITE_KEY, proto[name]) === true;

describe('@SysadminWrite markers', () => {
  it('platform operations are marked', () => {
    const p = AdminSchoolsController.prototype;
    for (const n of [
      'create',
      'setStatus',
      'listCodes',
      'createCode',
      'revokeCode',
    ])
      expect(marked(p, n)).toBe(true);
    expect(marked(SupportGrantController.prototype, 'create')).toBe(true);
    expect(marked(SupportGrantController.prototype, 'end')).toBe(true);
    expect(marked(PayoutController.prototype, 'updatePayout')).toBe(true);
  });

  it('school-admin writes are NOT marked (rotate, hours, canteens, members, codes)', () => {
    expect(marked(AdminSchoolsController.prototype, 'rotate')).toBe(false);
    for (const n of [
      'update',
      'rotate',
      'saveHours',
      'saveOverrides',
      'createCanteen',
      'updateCanteen',
      'deleteCanteen',
      'setRestaurantStatus',
      'approveMember',
      'rejectMember',
      'removeMember',
      'createCode',
      'revokeCode',
    ])
      expect(marked(SchoolsController.prototype, n)).toBe(false);
  });
});

describe('AdminSchoolsController', () => {
  const build = (over: any = {}) => {
    const schoolService: any = {
      createSchool: jest
        .fn()
        .mockResolvedValue({
          school: { schoolId: 's1', name: 'A' },
          adminCode: {},
        }),
      setSchoolStatus: jest
        .fn()
        .mockResolvedValue({
          schoolId: 's1',
          status: 'SUSPENDED',
          previous: 'ACTIVE',
        }),
    };
    const codes: any = {
      createSchoolCode: jest.fn().mockResolvedValue({ id: 'c1' }),
      revokeSchoolCode: jest.fn().mockResolvedValue({ revoked: true }),
      getSchoolCodeType: jest.fn().mockResolvedValue('SCHOOL_ADMIN'),
    };
    const access: any = {
      enforceSysadminPolicy: jest.fn().mockResolvedValue(undefined),
      ...over,
    };
    const audit: any = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      schoolService,
      codes,
      access,
      audit,
      ctl: new AdminSchoolsController(schoolService, codes, access, audit),
    };
  };
  const req: any = { user: { userId: 'a1' }, sysadminWrite: true };

  it('create school is audited', async () => {
    const { ctl, audit } = build();
    await ctl.create(req, { name: 'A', email: 'a@a.com' } as any);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_CREATE', schoolId: 's1' }),
    );
  });

  it('status change is audited with reason and from/to', async () => {
    const { ctl, audit, schoolService } = build();
    const res = await ctl.setStatus(req, 's1', {
      status: 'SUSPENDED',
      reason: 'unpaid invoice',
    });
    expect(schoolService.setSchoolStatus).toHaveBeenCalledWith(
      's1',
      'SUSPENDED',
    );
    expect(res).toEqual({
      schoolId: 's1',
      status: 'SUSPENDED',
      reason: 'unpaid invoice',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCHOOL_STATUS_CHANGE',
        reason: 'unpaid invoice',
        meta: { from: 'ACTIVE', to: 'SUSPENDED' },
      }),
    );
  });

  it('SCHOOL_ADMIN code create/revoke are audited and need no grant', async () => {
    const { ctl, audit, access } = build();
    await ctl.createCode(req, 's1', { type: 'SCHOOL_ADMIN' });
    await ctl.revokeCode(req, 's1', 'c1');
    expect(access.enforceSysadminPolicy).not.toHaveBeenCalled();
    expect(audit.record.mock.calls.map((c: any) => c[0].action)).toEqual([
      'SCHOOL_ADMIN_CODE_CREATE',
      'SCHOOL_ADMIN_CODE_REVOKE',
    ]);
  });

  it('SHOP_OWNER codes through the admin route require a grant (read-only otherwise)', async () => {
    const { ctl, codes, access } = build({
      enforceSysadminPolicy: jest
        .fn()
        .mockRejectedValue(
          new ForbiddenException({ code: 'SYSADMIN_READ_ONLY' }),
        ),
    });
    await expect(
      ctl.createCode({ ...req }, 's1', { type: 'SHOP_OWNER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(codes.createSchoolCode).not.toHaveBeenCalled();
    const r: any = { ...req };
    codes.getSchoolCodeType.mockResolvedValue('SHOP_OWNER');
    await expect(ctl.revokeCode(r, 's1', 'c2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(r.sysadminWrite).toBe(false);
    expect(codes.revokeSchoolCode).not.toHaveBeenCalled();
    expect(access.enforceSysadminPolicy).toHaveBeenCalled();
  });
});

describe('SchoolService.setSchoolStatus', () => {
  const make = (status: string | null) => {
    const prisma: any = {
      school: {
        findUnique: jest.fn().mockResolvedValue(status ? { status } : null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    return { prisma, svc: new SchoolService(prisma) };
  };
  it('suspends and reactivates', async () => {
    const a = make('ACTIVE');
    expect(await a.svc.setSchoolStatus('s1', 'SUSPENDED')).toMatchObject({
      status: 'SUSPENDED',
      previous: 'ACTIVE',
    });
    expect(a.prisma.school.update).toHaveBeenCalledWith({
      where: { schoolId: 's1' },
      data: { status: 'SUSPENDED' },
    });
    const b = make('SUSPENDED');
    await b.svc.setSchoolStatus('s1', 'ACTIVE');
    expect(b.prisma.school.update).toHaveBeenCalled();
  });
  it('404 unknown, 409 for REMOVED/PENDING', async () => {
    await expect(
      make(null).svc.setSchoolStatus('x', 'ACTIVE'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      make('REMOVED').svc.setSchoolStatus('x', 'ACTIVE'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('a suspended school rejects its student code with SCHOOL_SUSPENDED on change/join', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ schoolId: null }),
        updateMany: jest.fn(),
      },
      restaurantMembership: { findMany: jest.fn().mockResolvedValue([]) },
      schoolMembership: { findMany: jest.fn().mockResolvedValue([]) },
      school: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            schoolId: 's1',
            name: 'A',
            status: 'SUSPENDED',
          }),
      },
    };
    const err: any = await new SchoolService(prisma)
      .joinSchool('u1', 'ABCD-2345')
      .catch((e) => e);
    expect(err.getResponse().code).toBe('SCHOOL_SUSPENDED');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('SchoolStatusDto', () => {
  it('requires ACTIVE|SUSPENDED and a reason', async () => {
    const ok = plainToInstance(SchoolStatusDto, {
      status: 'SUSPENDED',
      reason: 'billing issue',
    });
    expect(await validate(ok)).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(SchoolStatusDto, {
            status: 'REMOVED',
            reason: 'billing issue',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(SchoolStatusDto, { status: 'ACTIVE' })))
        .length,
    ).toBeGreaterThan(0);
  });
});

// keeps the import used (typing aid for the access mock above)
void AccessService;
