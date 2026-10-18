import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolService } from './school.service';

const makePrisma = () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    inviteCode: { findUnique: jest.fn().mockResolvedValue(null) },
    school: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    restaurantMembership: { findMany: jest.fn().mockResolvedValue([]) },
    schoolMembership: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};

const build = (prisma: any) => new SchoolService(prisma);
const VALID = 'ABCD-2345';

describe('SchoolService join / change school', () => {
  it('joins with a valid code and sets User.schoolId', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: null });
    prisma.school.findFirst.mockResolvedValue({
      schoolId: 's1',
      name: 'School A',
    });

    const res = await build(prisma).joinSchool('u1', 'abcd 2345');

    expect(prisma.school.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inviteCode: 'ABCD2345',
          status: { in: ['ACTIVE', 'SUSPENDED'] },
        },
      }),
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', schoolId: null },
      data: { schoolId: 's1' },
    });
    expect(res).toEqual({ school: { schoolId: 's1', name: 'School A' } });
  });

  it('gives the same generic error for malformed and unknown codes', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: null });
    prisma.school.findFirst.mockResolvedValue(null);
    const svc = build(prisma);

    const malformed = await svc.joinSchool('u1', 'xx').catch((e) => e);
    const unknown = await svc.joinSchool('u1', VALID).catch((e) => e);
    expect(malformed).toBeInstanceOf(BadRequestException);
    expect(unknown).toBeInstanceOf(BadRequestException);
    expect(malformed.message).toBe(unknown.message);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to join when the user already has a school', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    await expect(build(prisma).joinSchool('u1', VALID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to join when a school-admin application is pending', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: null });
    prisma.schoolMembership.findMany.mockResolvedValue([
      { schoolId: 's9', school: { name: 'Mine' } },
    ]);
    await expect(build(prisma).joinSchool('u1', VALID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('loses the race when the compare-and-set updates nothing', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: null });
    prisma.school.findFirst.mockResolvedValue({ schoolId: 's1', name: 'A' });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(build(prisma).joinSchool('u1', VALID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('change school: blocked while the user has a shop, listing the blockers', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    prisma.restaurantMembership.findMany.mockResolvedValue([
      { restaurantId: 'r1', restaurant: { name: 'Noodles' } },
    ]);

    const err = await build(prisma)
      .changeSchool('u1', VALID)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().blockers).toEqual([
      { code: 'HAS_RESTAURANT', restaurantId: 'r1', name: 'Noodles' },
    ]);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('change school: blocked while the user is (or applied to be) a school admin', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    prisma.schoolMembership.findMany.mockResolvedValue([
      { schoolId: 's1', school: { name: 'A' } },
    ]);
    await expect(
      build(prisma).changeSchool('u1', VALID),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('change school: moves a plain student to the new school', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    prisma.school.findFirst.mockResolvedValue({ schoolId: 's2', name: 'B' });

    const res = await build(prisma).changeSchool('u1', VALID);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { schoolId: 's2' },
    });
    expect(res.school.schoolId).toBe('s2');
  });

  it('change school: same school is a no-op', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    prisma.school.findFirst.mockResolvedValue({ schoolId: 's1', name: 'A' });
    await build(prisma).changeSchool('u1', VALID);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('getMySchool never selects the invite code and 404s without a school', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ schoolId: null });
    await expect(build(prisma).getMySchool('u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    prisma.school.findUnique.mockResolvedValue({
      schoolId: 's1',
      name: 'A',
      profile: null,
      canteens: [],
    });
    await build(prisma).getMySchool('u1');
    expect(
      JSON.stringify(prisma.school.findUnique.mock.calls[0][0]),
    ).not.toContain('inviteCode');
  });
});

describe('SchoolService.createSchool', () => {
  const dto = {
    name: ' School A ',
    email: 'A@School.ac.th',
    studentAmount: 10,
  };

  const prismaForCreate = () => {
    const prisma = makePrisma();
    prisma.school.findFirst.mockResolvedValue(null);
    prisma.school.findUnique.mockResolvedValue(null);
    prisma.inviteCode.create = jest.fn(async ({ data }) => ({
      id: 'code1',
      ...data,
    }));
    prisma.school.create.mockImplementation(async ({ data }: any) => ({
      schoolId: 's1',
      profile: null,
      createdAt: new Date(),
      ...data,
    }));
    return prisma;
  };

  it('returns the school (with student code) and a SCHOOL_ADMIN code expiring in 7 days', async () => {
    const prisma = prismaForCreate();
    const before = Date.now();
    const res = await build(prisma).createSchool('sysadmin', dto);

    const schoolData = prisma.school.create.mock.calls[0][0].data;
    expect(schoolData).toMatchObject({
      name: 'School A',
      email: 'a@school.ac.th',
      status: 'ACTIVE',
      createdById: 'sysadmin',
    });
    expect(schoolData.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const codeData = prisma.inviteCode.create.mock.calls[0][0].data;
    expect(codeData).toMatchObject({
      type: 'SCHOOL_ADMIN',
      schoolId: 's1',
      createdById: 'sysadmin',
      maxUses: 1,
    });
    expect(codeData.code).not.toBe(schoolData.inviteCode);
    const days = (codeData.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);

    expect(res.school.status).toBe('ACTIVE');
    expect(res.school.inviteCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(res.adminCode.id).toBe('code1');
    expect(res.adminCode.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(res.adminCode.expiresAt).toEqual(codeData.expiresAt);
  });

  it('runs in one transaction and propagates a failure of the admin code (nothing returned)', async () => {
    const prisma = prismaForCreate();
    prisma.inviteCode.create.mockRejectedValue(new Error('boom'));
    await expect(build(prisma).createSchool('sysadmin', dto)).rejects.toThrow(
      'boom',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // both writes went through the transactional client
    expect(prisma.school.create).toHaveBeenCalledTimes(1);
  });

  it('409 on duplicate name or email, before writing anything', async () => {
    const prisma = prismaForCreate();
    prisma.school.findFirst.mockResolvedValueOnce({ schoolId: 'x' });
    const nameErr = await build(prisma)
      .createSchool('sysadmin', dto)
      .catch((e) => e);
    expect(nameErr).toBeInstanceOf(ConflictException);
    expect(nameErr.message).toContain('ชื่อ');

    const prisma2 = prismaForCreate();
    prisma2.school.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ schoolId: 'x' });
    const emailErr = await build(prisma2)
      .createSchool('sysadmin', dto)
      .catch((e) => e);
    expect(emailErr).toBeInstanceOf(ConflictException);
    expect(emailErr.message).toContain('อีเมล');
    expect(prisma.school.create).not.toHaveBeenCalled();
    expect(prisma2.school.create).not.toHaveBeenCalled();
  });

  it('409 when a concurrent create wins the unique race (P2002)', async () => {
    const prisma = prismaForCreate();
    prisma.school.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(
      build(prisma).createSchool('sysadmin', dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
