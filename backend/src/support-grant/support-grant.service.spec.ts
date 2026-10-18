import { NotFoundException } from '@nestjs/common';
import { SupportGrantService } from './support-grant.service';
import { CreateSupportGrantDto } from './dto/support-grant.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SUPPORT_GRANT_TTL_MINUTES } from '../access/access.constants';

const make = () => {
  const prisma: any = {
    school: { findUnique: jest.fn().mockResolvedValue({ schoolId: 's1' }) },
    supportGrant: {
      create: jest.fn(async ({ data }) => ({
        id: 'g1',
        revokedAt: null,
        createdAt: new Date(),
        ...data,
      })),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const audit: any = { record: jest.fn().mockResolvedValue(undefined) };
  return { prisma, audit, svc: new SupportGrantService(prisma, audit) };
};
const req: any = { user: { userId: 'a1' }, method: 'POST' };

describe('SupportGrantService', () => {
  it('creates a 30 minute grant and audits it with the reason', async () => {
    const { svc, prisma, audit } = make();
    const before = Date.now();
    const g = await svc.create(req, 's1', 'customer asked for help with menu');
    const ttl = g.expiresAt.getTime() - before;
    expect(SUPPORT_GRANT_TTL_MINUTES).toBe(30);
    expect(ttl).toBeGreaterThanOrEqual(30 * 60_000 - 1000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000 + 5000);
    expect(prisma.supportGrant.create.mock.calls[0][0].data).toMatchObject({
      adminId: 'a1',
      schoolId: 's1',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUPPORT_GRANT_CREATE',
        schoolId: 's1',
        supportGrantId: 'g1',
        reason: 'customer asked for help with menu',
      }),
    );
  });

  it('404 for an unknown school and writes nothing', async () => {
    const { svc, prisma, audit } = make();
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(
      svc.create(req, 'nope', 'long enough reason'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportGrant.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("ends only the caller's own grant of that school (revokedAt) and audits it", async () => {
    const { svc, prisma, audit } = make();
    prisma.supportGrant.findFirst.mockResolvedValue({
      id: 'g1',
      revokedAt: null,
    });
    const res = await svc.end(req, 's1', 'g1');
    expect(prisma.supportGrant.findFirst.mock.calls[0][0].where).toEqual({
      id: 'g1',
      schoolId: 's1',
      adminId: 'a1',
    });
    expect(
      prisma.supportGrant.update.mock.calls[0][0].data.revokedAt,
    ).toBeInstanceOf(Date);
    expect(res.revokedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPPORT_GRANT_END', entityId: 'g1' }),
    );
  });

  it("end: 404 when the grant is not found / not the caller's", async () => {
    const { svc, prisma } = make();
    prisma.supportGrant.findFirst.mockResolvedValue(null);
    await expect(svc.end(req, 's1', 'gX')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lists only the caller's unrevoked, unexpired grants", async () => {
    const { svc, prisma } = make();
    prisma.supportGrant.findMany.mockResolvedValue([
      {
        id: 'g1',
        schoolId: 's1',
        school: { name: 'A' },
        reason: 'r',
        expiresAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    const res = await svc.listActive('a1');
    const where = prisma.supportGrant.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ adminId: 'a1', revokedAt: null });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(res[0]).toMatchObject({ id: 'g1', schoolName: 'A' });
  });

  it('DTO requires a reason of at least 10 characters', async () => {
    const bad = plainToInstance(CreateSupportGrantDto, { reason: 'too short' });
    expect((await validate(bad)).length).toBe(1);
    const good = plainToInstance(CreateSupportGrantDto, {
      reason: '  long enough reason  ',
    });
    expect(await validate(good)).toHaveLength(0);
    expect(good.reason).toBe('long enough reason');
  });
});
