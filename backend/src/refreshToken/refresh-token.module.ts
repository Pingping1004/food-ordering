import { Module } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { RefreshTokenService } from './refresh-token.service'

@Module({
    providers: [RefreshTokenService],
    exports: [RefreshTokenService],
})

export class RefreshTokenModule {}