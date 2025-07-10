import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshToken } from '@prisma/client';

@Injectable()

export class RefreshTokenService {
    constructor(private readonly prisma: PrismaService) { }

    async createRefreshtToken(data: { 
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
                isRevoked: false,
            },
        });
        return token ?? undefined;
    }

    async markTokenAsUsed(jti: string): Promise<void> {
        await this.prisma.refreshToken.update({
            where: { jti },
            data: { isUsed: true },
        });
    }

    async invalidateAllUserRefreshTokens(UserId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: {
                userId: UserId,
                isRevoked: false,
            },
            data: { isRevoked: true },
        });
    }

    async revokeToken(jti: string): Promise<void> {
        await this.prisma.refreshToken.update({
            where: { jti },
            data: { isRevoked: true },
        });
    }
}