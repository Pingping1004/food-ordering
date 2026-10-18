import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InviteCodeService, INVALID_CODE_MESSAGE } from './invite-code.service';
import { CreateSchoolCodeDto, CreateStaffCodeDto } from './dto/invite.dto';

const CODE = 'ABCD-2345';
const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 1000);

const typedCode = (over: any = {}) => ({
  id: 'c1',
  code: 'ABCD2345',
  type: 'SHOP_OWNER',
  schoolId: 's1',
  restaurantId: null,
  maxUses: 1,
  usedCount: 0,
  expiresAt: future(),
  revokedAt: null,
  createdAt: new Date(),
  school: { schoolId: 's1', name: 'School A', status: 'ACTIVE' },
  restaurant: null,
  createdBy: { role: 'USER' },
  ...over,
});

const makePrisma = () => {
  const prisma: any = {
    inviteCode: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(async ({ data }) => ({
        id: 'new',
        createdAt: new Date(),
        usedCount: 0,
        revokedAt: null,
        restaurant: null,
        restaurantId: null,
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    inviteRedemption: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    school: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ schoolId: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    restaurant: { findUnique: jest.fn() },
    restaurantMembership: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
    },
    schoolMembership: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};
const build = (prisma: any) => new InviteCodeService(prisma);

describe('InviteCodeService.redeem - effect per code type', () => {
  it('STUDENT (School.inviteCode): sets schoolId, ACTIVE, no membership', async () => {
    const prisma = makePrisma();
    prisma.school.findFirst.mockResolvedValue({
      schoolId: 's1',
      name: 'School A',
    });

    const res = await build(prisma).redeem('u1', 'abcd 2345');

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
    expect(prisma.restaurantMembership.create).not.toHaveBeenCalled();
    expect(prisma.schoolMembership.create).not.toHaveBeenCalled();
    expect(res).toEqual({
      type: 'STUDENT',
      school: { schoolId: 's1', name: 'School A' },
      status: 'ACTIVE',
    });
  });

  it('SHOP_OWNER: sets schoolId and records an UNCONSUMED redemption, no membership', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(typedCode());

    const res = await build(prisma).redeem('u1', CODE);

    expect(prisma.inviteCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', revokedAt: null, usedCount: { lt: 1 } },
      data: { usedCount: { increment: 1 } },
    });
    expect(prisma.inviteRedemption.create).toHaveBeenCalledWith({
      data: { codeId: 'c1', userId: 'u1' },
    }); // consumedAt stays null
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', OR: [{ schoolId: null }, { schoolId: 's1' }] },
      data: { schoolId: 's1' },
    });
    expect(prisma.restaurantMembership.create).not.toHaveBeenCalled();
    expect(res).toEqual({
      type: 'SHOP_OWNER',
      school: { schoolId: 's1', name: 'School A' },
      status: 'ACTIVE',
    });
  });

  it('SHOP_STAFF: creates RestaurantMembership{STAFF, PENDING} and reports the restaurant', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({
        type: 'SHOP_STAFF',
        restaurantId: 'r1',
        maxUses: 0,
        expiresAt: null,
        usedCount: 57,
        restaurant: { restaurantId: 'r1', name: 'Noodles', status: 'ACTIVE' },
      }),
    );

    const res = await build(prisma).redeem('u1', CODE);

    expect(prisma.inviteCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', revokedAt: null },
      data: { usedCount: { increment: 1 } },
    }); // unlimited
    expect(prisma.restaurantMembership.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        restaurantId: 'r1',
        role: 'STAFF',
        status: 'PENDING',
      },
    });
    expect(res).toEqual({
      type: 'SHOP_STAFF',
      school: { schoolId: 's1', name: 'School A' },
      restaurant: { restaurantId: 'r1', name: 'Noodles' },
      status: 'PENDING',
    });
  });

  it('SHOP_STAFF: an already approved member is not downgraded; a REJECTED one is re-opened', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({
        type: 'SHOP_STAFF',
        restaurantId: 'r1',
        maxUses: 0,
        restaurant: { restaurantId: 'r1', name: 'N', status: 'ACTIVE' },
      }),
    );
    prisma.restaurantMembership.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'APPROVED',
      role: 'OWNER',
    });
    await expect(build(prisma).redeem('u1', CODE)).resolves.toMatchObject({
      status: 'ACTIVE',
    });
    expect(prisma.restaurantMembership.update).not.toHaveBeenCalled();

    prisma.restaurantMembership.findUnique.mockResolvedValue({
      id: 'm1',
      status: 'REJECTED',
      role: 'STAFF',
    });
    await expect(build(prisma).redeem('u2', CODE)).resolves.toMatchObject({
      status: 'PENDING',
    });
    expect(prisma.restaurantMembership.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { role: 'STAFF', status: 'PENDING' },
    });
  });

  it('SCHOOL_ADMIN issued by a school admin: creates SchoolMembership{ADMIN, PENDING}', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ type: 'SCHOOL_ADMIN' }),
    );

    const res = await build(prisma).redeem('u1', CODE);

    expect(prisma.schoolMembership.create).toHaveBeenCalledWith({
      data: { userId: 'u1', schoolId: 's1', role: 'ADMIN', status: 'PENDING' },
    });
    expect(res).toEqual({
      type: 'SCHOOL_ADMIN',
      school: { schoolId: 's1', name: 'School A' },
      status: 'PENDING',
    });
  });

  it('SCHOOL_ADMIN issued by a SYSTEM admin: APPROVED immediately and ACTIVE', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ type: 'SCHOOL_ADMIN', createdBy: { role: 'ADMIN' } }),
    );

    const res = await build(prisma).redeem('u1', CODE);

    expect(prisma.schoolMembership.create).toHaveBeenCalledWith({
      data: { userId: 'u1', schoolId: 's1', role: 'ADMIN', status: 'APPROVED' },
    });
    expect(res).toEqual({
      type: 'SCHOOL_ADMIN',
      school: { schoolId: 's1', name: 'School A' },
      status: 'ACTIVE',
    });
  });

  it('SCHOOL_ADMIN issued by a sysadmin upgrades an existing PENDING membership', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ type: 'SCHOOL_ADMIN', createdBy: { role: 'ADMIN' } }),
    );
    prisma.schoolMembership.findUnique.mockResolvedValue({
      id: 'm1',
      role: 'ADMIN',
      status: 'PENDING',
    });
    prisma.schoolMembership.update = jest.fn();

    const res = await build(prisma).redeem('u1', CODE);
    expect(prisma.schoolMembership.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { role: 'ADMIN', status: 'APPROVED' },
    });
    expect(res.status).toBe('ACTIVE');
  });

  it('SCHOOL_ADMIN with a deleted creator (null) stays PENDING', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ type: 'SCHOOL_ADMIN', createdBy: null }),
    );
    const res = await build(prisma).redeem('u1', CODE);
    expect(res.status).toBe('PENDING');
  });
});

describe('InviteCodeService.redeem - rejection and idempotency', () => {
  const expectGeneric = async (prisma: any, rawCode = CODE) => {
    const err = await build(prisma)
      .redeem('u1', rawCode)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toBe(INVALID_CODE_MESSAGE);
    expect(prisma.inviteRedemption.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  };

  it('rejects expired, revoked and used-up codes with the same generic 400', async () => {
    for (const over of [
      { expiresAt: past() },
      { revokedAt: new Date() },
      { usedCount: 1, maxUses: 1 },
    ]) {
      const prisma = makePrisma();
      prisma.inviteCode.findUnique.mockResolvedValue(typedCode(over));
      await expectGeneric(prisma);
    }
  });

  it('rejects codes of an inactive school or a REMOVED shop', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ school: { schoolId: 's1', name: 'x', status: 'PENDING' } }),
    );
    await expectGeneric(prisma);

    const prisma2 = makePrisma();
    prisma2.inviteCode.findUnique.mockResolvedValue(
      typedCode({
        type: 'SHOP_STAFF',
        restaurantId: 'r1',
        maxUses: 0,
        restaurant: { restaurantId: 'r1', name: 'x', status: 'REMOVED' },
      }),
    );
    await expectGeneric(prisma2);
  });

  it('malformed, unknown and bad codes are indistinguishable', async () => {
    const messages: string[] = [];
    for (const raw of ['xx', CODE]) {
      const prisma = makePrisma(); // both lookups return null
      const err = await build(prisma)
        .redeem('u1', raw)
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      messages.push(err.message);
    }
    expect(new Set(messages).size).toBe(1);
  });

  it('loses a concurrent race for the last use -> generic 400, nothing created', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(typedCode());
    prisma.inviteCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(build(prisma).redeem('u1', CODE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.inviteRedemption.create).not.toHaveBeenCalled();
  });

  it('is idempotent: a repeat by the same user does not consume another use (even if now used up)', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ usedCount: 1, maxUses: 1 }),
    );
    prisma.inviteRedemption.findUnique.mockResolvedValue({ id: 'red1' });

    await expect(build(prisma).redeem('u1', CODE)).resolves.toMatchObject({
      type: 'SHOP_OWNER',
      status: 'ACTIVE',
    });
    expect(prisma.inviteCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.inviteRedemption.create).not.toHaveBeenCalled();
  });

  it('treats a unique-constraint race on the redemption as a repeat', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(typedCode());
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(build(prisma).redeem('u1', CODE)).resolves.toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('student code: same school is a no-op, a different school is 409', async () => {
    const prisma = makePrisma();
    prisma.school.findFirst.mockResolvedValue({
      schoolId: 's1',
      name: 'School A',
    });
    prisma.user.findUnique.mockResolvedValue({ schoolId: 's1' });
    await expect(build(prisma).redeem('u1', CODE)).resolves.toMatchObject({
      type: 'STUDENT',
      status: 'ACTIVE',
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue({ schoolId: 'other' });
    await expect(build(prisma).redeem('u1', CODE)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("typed code of another school than the user's is 409 and consumes nothing", async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(typedCode());
    prisma.user.findUnique.mockResolvedValue({ schoolId: 'other' });
    await expect(build(prisma).redeem('u1', CODE)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.inviteCode.updateMany).not.toHaveBeenCalled();
  });

  it('student code is refused while a school-admin application is pending', async () => {
    const prisma = makePrisma();
    prisma.school.findFirst.mockResolvedValue({ schoolId: 's1', name: 'A' });
    prisma.schoolMembership.findFirst.mockResolvedValue({ id: 'm' });
    await expect(build(prisma).redeem('u1', CODE)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('code creation: who can create which type', () => {
  const validateDto = (cls: any, plain: object) =>
    validate(plainToInstance(cls, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('school endpoint DTO accepts only SHOP_OWNER and SCHOOL_ADMIN', async () => {
    expect(
      await validateDto(CreateSchoolCodeDto, { type: 'SHOP_OWNER' }),
    ).toHaveLength(0);
    expect(
      await validateDto(CreateSchoolCodeDto, {
        type: 'SCHOOL_ADMIN',
        maxUses: 3,
        expiresInDays: 2,
      }),
    ).toHaveLength(0);
    expect(
      await validateDto(CreateSchoolCodeDto, { type: 'STUDENT' }),
    ).not.toHaveLength(0);
    expect(
      await validateDto(CreateSchoolCodeDto, { type: 'SHOP_STAFF' }),
    ).not.toHaveLength(0);
    expect(
      await validateDto(CreateSchoolCodeDto, {
        type: 'SHOP_OWNER',
        maxUses: 0,
      }),
    ).not.toHaveLength(0);
    expect(
      await validateDto(CreateSchoolCodeDto, {
        type: 'SHOP_OWNER',
        expiresInDays: 9999,
      }),
    ).not.toHaveLength(0);
    expect(
      await validateDto(CreateStaffCodeDto, { type: 'SHOP_OWNER' }),
    ).not.toHaveLength(0); // staff endpoint takes no type
  });

  it('SHOP_OWNER defaults: 1 use, 14 days; SCHOOL_ADMIN defaults: 1 use, 7 days', async () => {
    const prisma = makePrisma();
    // the code-uniqueness probe looks up by inviteCode (free); the school lookup is by schoolId
    prisma.school.findUnique.mockImplementation(async ({ where }: any) =>
      where.schoolId ? { status: 'ACTIVE' } : null,
    );
    const svc = build(prisma);

    const owner = await svc.createSchoolCode('s1', 'admin1', {
      type: 'SHOP_OWNER',
    });
    const admin = await svc.createSchoolCode('s1', 'admin1', {
      type: 'SCHOOL_ADMIN',
    });
    const days = (d: Date) =>
      Math.round((d.getTime() - Date.now()) / 86_400_000);

    expect(owner).toMatchObject({
      type: 'SHOP_OWNER',
      maxUses: 1,
      usedCount: 0,
      revoked: false,
      state: 'ACTIVE',
    });
    expect(days(owner.expiresAt as Date)).toBe(14);
    expect(admin).toMatchObject({ type: 'SCHOOL_ADMIN', maxUses: 1 });
    expect(days(admin.expiresAt as Date)).toBe(7);
    expect(prisma.inviteCode.create.mock.calls[0][0].data).toMatchObject({
      schoolId: 's1',
      createdById: 'admin1',
    });
    expect(owner.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('caps school admins at 5 per school (members + open code uses) on create and redeem', async () => {
    const prisma = makePrisma();
    prisma.school.findUnique.mockImplementation(async ({ where }: any) =>
      where.schoolId ? { status: 'ACTIVE' } : null,
    );
    prisma.schoolMembership.count.mockResolvedValue(3);
    prisma.inviteCode.findMany = jest
      .fn()
      .mockResolvedValue([{ maxUses: 2, usedCount: 1 }]); // 1 use still open -> 4 reserved
    const svc = build(prisma);

    await expect(
      svc.createSchoolCode('s1', 'a', { type: 'SCHOOL_ADMIN', maxUses: 2 }),
    ).rejects.toThrow(/ไม่เกิน 5/);
    await expect(
      svc.createSchoolCode('s1', 'a', { type: 'SCHOOL_ADMIN', maxUses: 1 }),
    ).resolves.toMatchObject({ type: 'SCHOOL_ADMIN' });
  });

  it('refuses a STUDENT / SHOP_STAFF type even if the DTO were bypassed, and a non-active school', async () => {
    const prisma = makePrisma();
    prisma.school.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    await expect(
      build(prisma).createSchoolCode('s1', 'a', { type: 'SHOP_STAFF' as any }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build(prisma).createSchoolCode('s1', 'a', { type: 'STUDENT' as any }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.school.findUnique.mockResolvedValue({ status: 'PENDING' });
    await expect(
      build(prisma).createSchoolCode('s1', 'a', { type: 'SHOP_OWNER' }),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(
      build(prisma).createSchoolCode('s1', 'a', { type: 'SHOP_OWNER' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('staff code is bound to the restaurant, unlimited, optional expiry; REMOVED shop refused', async () => {
    const prisma = makePrisma();
    prisma.restaurant.findUnique.mockResolvedValue({
      restaurantId: 'r1',
      name: 'Noodles',
      status: 'ACTIVE',
      canteen: { schoolId: 's1' },
    });
    const res = await build(prisma).createStaffCode('r1', 'owner1', {});
    expect(prisma.inviteCode.create.mock.calls[0][0].data).toMatchObject({
      type: 'SHOP_STAFF',
      schoolId: 's1',
      restaurantId: 'r1',
      createdById: 'owner1',
      maxUses: 0,
      expiresAt: null,
    });
    expect(res.state).toBe('ACTIVE');

    prisma.restaurant.findUnique.mockResolvedValue({
      restaurantId: 'r1',
      name: 'x',
      status: 'REMOVED',
      canteen: { schoolId: 's1' },
    });
    await expect(
      build(prisma).createStaffCode('r1', 'owner1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revoke only touches codes of that school/restaurant (never the student code)', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findFirst.mockResolvedValue(null);
    await expect(
      build(prisma).revokeSchoolCode('s1', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inviteCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'x', schoolId: 's1', type: { not: 'STUDENT' } },
      }),
    );
    await expect(
      build(prisma).revokeStaffCode('r1', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.inviteCode.findFirst.mockResolvedValue({ id: 'x' });
    await expect(build(prisma).revokeSchoolCode('s1', 'x')).resolves.toEqual({
      revoked: true,
    });
    expect(prisma.inviteCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'x', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('list reports state and never includes student codes', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findMany.mockResolvedValue([
      typedCode({ expiresAt: past() }),
      typedCode({ id: 'c2', revokedAt: new Date() }),
      typedCode({ id: 'c3', usedCount: 1 }),
    ]);
    const list = await build(prisma).listSchoolCodes('s1');
    expect(prisma.inviteCode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: 's1', type: { not: 'STUDENT' } },
      }),
    );
    expect(list.map((c) => c.state)).toEqual(['EXPIRED', 'REVOKED', 'USED_UP']);
  });
});

describe('InviteCodeService.redeem - suspended school', () => {
  it('a live typed code of a SUSPENDED school gets a clear 403 SCHOOL_SUSPENDED', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({ school: { schoolId: 's1', name: 'x', status: 'SUSPENDED' } }),
    );
    const err: any = await build(prisma)
      .redeem('u1', CODE)
      .catch((e) => e);
    expect(err.getStatus()).toBe(403);
    expect(err.getResponse().code).toBe('SCHOOL_SUSPENDED');
    expect(prisma.inviteRedemption.create).not.toHaveBeenCalled();
  });

  it('the student code of a SUSPENDED school gets 403 SCHOOL_SUSPENDED', async () => {
    const prisma = makePrisma();
    prisma.school.findFirst.mockResolvedValue({
      schoolId: 's1',
      name: 'x',
      status: 'SUSPENDED',
    });
    const err: any = await build(prisma)
      .redeem('u1', CODE)
      .catch((e) => e);
    expect(err.getResponse().code).toBe('SCHOOL_SUSPENDED');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('an expired code of a SUSPENDED school stays a generic 400', async () => {
    const prisma = makePrisma();
    prisma.inviteCode.findUnique.mockResolvedValue(
      typedCode({
        expiresAt: past(),
        school: { schoolId: 's1', name: 'x', status: 'SUSPENDED' },
      }),
    );
    const err = await build(prisma)
      .redeem('u1', CODE)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
  });
});
