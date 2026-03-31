import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RefreshToken } from '@prisma/client';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) { }

  async createRefreshToken(data: {
    token: string;
    jti: string;
    userId: string;
    expiresAt: Date;
    issuedAt: Date;
  }): Promise<RefreshToken> {
    const newRefreshToken = await this.prisma.refreshToken.create({
      data,
    });
    return newRefreshToken;
  }

  async findTokenByJti(jti: string): Promise<RefreshToken | undefined> {
    const token = await this.prisma.refreshToken.findUnique({
      where: {
        jti,
        // isRevoked: false,
      },
    });
    return token ?? undefined;
  }

  async updateTokenExpiry(jti: string, newExpiry: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { jti },
      data: { expiresAt: newExpiry },
    });
  }

  async revokeToken(jti: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { jti },
      data: { isRevoked: true },
    });
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { isRevoked: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    return result.count;
  }
}