import { Module } from "@nestjs/common";
import { AnalyticsService } from "../analytics.service";
import { PrismaService } from "src/prisma/prisma.service";

@Module({
    providers: [AnalyticsService, PrismaService],
    exports: [AnalyticsService],
})

export class AnalyticsModule {}