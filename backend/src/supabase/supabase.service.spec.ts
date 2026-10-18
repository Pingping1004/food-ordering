import { decodeAal, SupabaseService } from './supabase.service';

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

describe('decodeAal', () => {
  it('reads aal from the payload', () => {
    expect(decodeAal(jwt({ aal: 'aal2' }))).toBe('aal2');
    expect(decodeAal(jwt({ aal: 'aal1' }))).toBe('aal1');
  });
  it('returns null for missing/garbage', () => {
    expect(decodeAal(jwt({}))).toBeNull();
    expect(decodeAal('garbage')).toBeNull();
  });
});

describe('SupabaseService', () => {
  const config = (values: Record<string, string>) =>
    ({ get: (k: string) => values[k] }) as any;

  it('verifyAccessToken returns aal after getUser succeeds', async () => {
    const svc = new SupabaseService(config({}), {} as any);
    (svc as any).client = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'a@b.c', user_metadata: {} } },
          error: null,
        }),
      },
    };
    const id = await svc.verifyAccessToken(jwt({ aal: 'aal2' }));
    expect(id?.aal).toBe('aal2');
  });

  it('deleteAuthUser throws without the service-role key', async () => {
    const svc = new SupabaseService(config({}), {} as any);
    await expect(svc.deleteAuthUser('u1')).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('deleteAuthUser throws when Supabase errors', async () => {
    const svc = new SupabaseService(
      config({ SUPABASE_SERVICE_ROLE_KEY: 'k' }),
      {} as any,
    );
    (svc as any).client = {
      auth: {
        admin: {
          deleteUser: jest
            .fn()
            .mockResolvedValue({ error: { message: 'boom' } }),
        },
      },
    };
    await expect(svc.deleteAuthUser('u1')).rejects.toThrow(/boom/);
  });
});

describe('SupabaseService auth load-shedding', () => {
  const config = () => ({ get: () => undefined }) as any;
  const withClient = (getUser: jest.Mock, prisma: any = {}) => {
    const svc = new SupabaseService(config(), prisma);
    (svc as any).client = { auth: { getUser } };
    return svc;
  };
  const ok = (id = 'u1') => ({ data: { user: { id, email: null, user_metadata: {} } }, error: null });

  it('should call Supabase once for 100 concurrent requests carrying the same token', async () => {
    const getUser = jest.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r(ok()), 20)));
    const svc = withClient(getUser);
    const results = await Promise.all(Array.from({ length: 100 }, () => svc.verifyAccessToken(jwt({ n: 1 }))));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.id === 'u1')).toBe(true);
  });

  it('should remember a rejected token (4xx) so a garbage-token flood does not reach Supabase', async () => {
    const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: { status: 401, message: 'bad jwt' } });
    const svc = withClient(getUser);
    for (let i = 0; i < 50; i++) expect(await svc.verifyAccessToken('garbage')).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('should NOT remember a failure caused by a Supabase outage (5xx) so good tokens recover', async () => {
    const getUser = jest
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: { status: 503, message: 'down' } })
      .mockResolvedValueOnce(ok());
    const svc = withClient(getUser);
    expect(await svc.verifyAccessToken('t1')).toBeNull();
    expect((await svc.verifyAccessToken('t1'))?.id).toBe('u1');
  });

  it('should read the user row once for repeated requests within the cache window', async () => {
    const findUnique = jest.fn().mockResolvedValue({ userId: 'u1', email: null, role: 'USER' });
    const svc = withClient(jest.fn(), { user: { findUnique } });
    for (let i = 0; i < 20; i++) await svc.resolveUser({ id: 'u1', email: null, name: null, aal: null });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('should re-read the user row after forgetUser (sign-out / account deletion)', async () => {
    const findUnique = jest.fn().mockResolvedValue({ userId: 'u1', email: null, role: 'USER' });
    const svc = withClient(jest.fn(), { user: { findUnique } });
    await svc.resolveUser({ id: 'u1', email: null, name: null, aal: null });
    svc.forgetUser('u1');
    await svc.resolveUser({ id: 'u1', email: null, name: null, aal: null });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
