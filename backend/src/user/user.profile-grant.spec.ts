import { UserService } from './user.service';

const make = (role: string) => {
  const prisma: any = {
    safeRead: (fn: any) => fn(),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        userId: 'a1',
        email: 'a@a',
        name: 'A',
        role,
        school: null,
        inviteRedemptions: [],
        restaurantMemberships: [],
        schoolMemberships: [],
      }),
    },
    supportGrant: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          schoolId: 's1',
          expiresAt: new Date('2030-01-01'),
          reason: 'help',
        }),
    },
  };
  return { prisma, svc: new UserService(prisma, {} as any, {} as any) };
};

describe('GET /user/profile supportGrant', () => {
  it('sysadmin (aal2) sees their active grant', async () => {
    const { svc } = make('ADMIN');
    expect((await svc.findOneUser('a1', 'aal2')).supportGrant).toEqual({
      schoolId: 's1',
      expiresAt: new Date('2030-01-01'),
      reason: 'help',
    });
  });
  it('is null for non-sysadmins, aal1 and other-user lookups, without querying', async () => {
    const u = make('USER');
    expect((await u.svc.findOneUser('a1', 'aal2')).supportGrant).toBeNull();
    const a = make('ADMIN');
    expect((await a.svc.findOneUser('a1', 'aal1')).supportGrant).toBeNull();
    expect((await a.svc.findOneUser('a1')).supportGrant).toBeNull();
    expect(a.prisma.supportGrant.findFirst).not.toHaveBeenCalled();
    expect(u.prisma.supportGrant.findFirst).not.toHaveBeenCalled();
  });
  it('is null when there is no active grant', async () => {
    const { svc, prisma } = make('ADMIN');
    prisma.supportGrant.findFirst.mockResolvedValue(null);
    expect((await svc.findOneUser('a1', 'aal2')).supportGrant).toBeNull();
  });
});
