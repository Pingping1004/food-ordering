import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

/** The identity Supabase vouches for. */
export interface AuthIdentity {
  id: string;
  email: string | null;
  name: string | null;
  /** Authenticator assurance level from the JWT: 'aal1' (password) or 'aal2' (password + TOTP). */
  aal: string | null;
}

/** What controllers receive as `req.user` (role comes from OUR database, never from the token). */
export interface RequestUser {
  userId: string;
  email: string | null;
  role: Role;
  /** JWT `aal` claim; set by SupabaseAuthGuard, not stored in our database. */
  aal?: string | null;
}

/** Reads the `aal` claim from a JWT. Only call after Supabase has verified the token. */
export function decodeAal(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload?.aal === 'string' ? payload.aal : null;
  } catch {
    return null;
  }
}

const TOKEN_CACHE_TTL_MS = 30_000;
const TOKEN_CACHE_MAX = 5_000;

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client!: SupabaseClient;
  private readonly hasServiceRole: boolean;
  private readonly cache = new Map<
    string,
    { identity: AuthIdentity; expiresAt: number }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.hasServiceRole = !!this.config.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.config.get<string>('SUPABASE_ANON_KEY');
    if (!url || !key)
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required',
      );

    // Stateless: the browser owns the session; the API only checks the bearer token it is handed.
    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  /**
   * Validates an access token with Supabase Auth (signature, expiry, revoked sessions).
   * Positive results are cached for 30 s so a burst of requests costs one round-trip.
   */
  async verifyAccessToken(token: string): Promise<AuthIdentity | null> {
    const hit = this.cache.get(token);
    if (hit && hit.expiresAt > Date.now()) return hit.identity;
    this.cache.delete(token);

    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) return null;

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const identity: AuthIdentity = {
      id: data.user.id,
      email: data.user.email ?? null,
      name:
        typeof meta.name === 'string'
          ? meta.name
          : typeof meta.full_name === 'string'
            ? meta.full_name
            : null,
      aal: decodeAal(token),
    };

    if (this.cache.size >= TOKEN_CACHE_MAX)
      this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(token, {
      identity,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
    });
    return identity;
  }

  /**
   * Maps a Supabase identity to the app's `User` row (same uuid), creating it on first sign-in.
   * The row holds app data only (role, memberships) – credentials live in Supabase.
   */
  async resolveUser(identity: AuthIdentity): Promise<RequestUser> {
    const select = { userId: true, email: true, role: true } as const;
    const existing = await this.prisma.user.findUnique({
      where: { userId: identity.id },
      select,
    });
    if (existing) return existing;

    try {
      return await this.prisma.user.create({
        data: {
          userId: identity.id,
          email: identity.email,
          name: identity.name ?? identity.email?.split('@')[0] ?? 'user',
          role: Role.USER,
        },
        select,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Concurrent first requests → someone else created it. Otherwise the e-mail belongs to a legacy row with another id.
        const again = await this.prisma.user.findUnique({
          where: { userId: identity.id },
          select,
        });
        if (again) return again;
        this.logger.error(
          `E-mail ${identity.email} already belongs to a different user id – run scripts/migrate-users-to-supabase.ts`,
        );
        throw new ConflictException(
          'บัญชีนี้ยังไม่ได้ย้ายเข้าระบบใหม่ กรุณาติดต่อผู้ดูแล',
        );
      }
      throw err;
    }
  }

  /** Drop cached tokens of a user (after role changes the next request re-reads the DB anyway; this is for sign-out-everywhere). */
  forgetUser(userId: string) {
    for (const [token, v] of this.cache)
      if (v.identity.id === userId) this.cache.delete(token);
  }

  /** Throws (500) when auth users cannot be deleted; call before destroying data. */
  assertCanDeleteAuthUsers(): void {
    if (!this.hasServiceRole) {
      throw new InternalServerErrorException(
        'ไม่สามารถลบบัญชีได้ในขณะนี้ (server is not configured for account deletion)',
      );
    }
  }

  /** Needs SUPABASE_SERVICE_ROLE_KEY. Used when an admin deletes a user so the login disappears too. */
  async deleteAuthUser(userId: string): Promise<void> {
    if (!this.hasServiceRole) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not set – cannot delete the auth user',
      );
    }
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) {
      this.logger.error(`deleteAuthUser failed: ${error.message}`);
      throw new Error(`deleteAuthUser failed: ${error.message}`);
    }
    this.forgetUser(userId);
  }
}
