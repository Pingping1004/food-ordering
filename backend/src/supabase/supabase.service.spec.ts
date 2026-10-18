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
