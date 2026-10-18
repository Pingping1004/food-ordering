import { ConflictException } from '@nestjs/common';
import { UserService } from './user.service';

const makePrisma = () => {
  const prisma: any = {
    restaurantMembership: { findMany: jest.fn().mockResolvedValue([]) },
    schoolMembership: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    },
    school: { deleteMany: jest.fn() },
    user: { delete: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};

const makeSupabase = () => ({
  assertCanDeleteAuthUsers: jest.fn(),
  deleteAuthUser: jest.fn().mockResolvedValue(undefined),
});
const build = (prisma: any, supabase: any) =>
  new UserService(prisma, {} as any, supabase);

describe('UserService.deleteMyAccount', () => {
  it('is blocked while the user owns a live restaurant', async () => {
    const prisma = makePrisma();
    const supabase = makeSupabase();
    prisma.restaurantMembership.findMany.mockResolvedValue([
      { restaurantId: 'r1', restaurant: { name: 'Noodles' } },
    ]);

    const err = await build(prisma, supabase)
      .deleteMyAccount('u1')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().blockers).toEqual([
      { code: 'OWNS_RESTAURANT', restaurantId: 'r1', name: 'Noodles' },
    ]);
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(supabase.deleteAuthUser).not.toHaveBeenCalled();
    // REMOVED shops must not block
    expect(
      prisma.restaurantMembership.findMany.mock.calls[0][0].where.restaurant,
    ).toEqual({ status: { not: 'REMOVED' } });
  });

  it('is blocked for the last approved admin of an ACTIVE school', async () => {
    const prisma = makePrisma();
    prisma.schoolMembership.findMany.mockResolvedValue([
      { schoolId: 's1', school: { name: 'A' } },
    ]);
    prisma.schoolMembership.count.mockResolvedValue(1);

    const err = await build(prisma, makeSupabase())
      .deleteMyAccount('u1')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().blockers).toEqual([
      { code: 'LAST_SCHOOL_ADMIN', schoolId: 's1', name: 'A' },
    ]);
  });

  it('reports every blocker at once', async () => {
    const prisma = makePrisma();
    prisma.restaurantMembership.findMany.mockResolvedValue([
      { restaurantId: 'r1', restaurant: { name: 'N' } },
    ]);
    prisma.schoolMembership.findMany.mockResolvedValue([
      { schoolId: 's1', school: { name: 'A' } },
    ]);
    prisma.schoolMembership.count.mockResolvedValue(1);
    const err = await build(prisma, makeSupabase())
      .deleteMyAccount('u1')
      .catch((e) => e);
    expect(err.getResponse().blockers).toHaveLength(2);
  });

  it('is allowed when another admin remains, and removes DB row then Supabase user', async () => {
    const prisma = makePrisma();
    const supabase = makeSupabase();
    prisma.schoolMembership.findMany.mockResolvedValue([
      { schoolId: 's1', school: { name: 'A' } },
    ]);
    prisma.schoolMembership.count.mockResolvedValue(2);

    await expect(
      build(prisma, supabase).deleteMyAccount('u1'),
    ).resolves.toEqual({ deleted: true });
    expect(prisma.school.deleteMany).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(supabase.deleteAuthUser).toHaveBeenCalledWith('u1');
  });

  it('fails loudly before deleting anything when Supabase cannot delete users', async () => {
    const prisma = makePrisma();
    const supabase = makeSupabase();
    supabase.assertCanDeleteAuthUsers.mockImplementation(() => {
      throw new Error('no service role key');
    });

    await expect(build(prisma, supabase).deleteMyAccount('u1')).rejects.toThrow(
      'no service role key',
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
