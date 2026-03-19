import { Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import moment from "moment";
import { MenuService } from "src/menu/menu.service";
import { clearMenuQuotaCache } from "src/menu/menuCache";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class InventoryService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => MenuService))
        private readonly menuService: MenuService,
    ) { }

    private pendingQuotaRequests = new Map<string, Promise<Record<string, number>>>();

    async deductInventoryTx(
        tx: Prisma.TransactionClient,
        menuId: string,
        quantity: number,
        menuName: string,
        maxDaily: number
    ): Promise<string | null> {
        const today = moment().tz('Asia/Bangkok').startOf('day').toDate();

        await tx.inventory.upsert({
            where: {
                menuId_date: { menuId, date: today }
            },
            update: {},
            create: {
                menuId,
                date: today,
                dailyQuota: maxDaily,
                remaining: maxDaily
            }
        })

        const result = await tx.inventory.updateMany({
            where: {
                menuId,
                date: today,
                remaining: { gte: quantity }
            },
            data: {
                remaining: { decrement: quantity }
            }
        });

        if (result.count === 0) return menuName;

        return null;
    }

    async getRemainingQuotas(menuIds: string[]): Promise<Record<string, number>> {
        if (menuIds.length === 0) return {}

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const sortedMenuIds = [...menuIds].sort()
        const requestKey = `${today.toISOString()}-${JSON.stringify(sortedMenuIds)}`

        if (this.pendingQuotaRequests.has(requestKey)) return this.pendingQuotaRequests.get(requestKey)!

        const requestPromise = (async () => {
            const inventories = await this.prisma.inventory.findMany({
                where: {
                    menuId: { in: sortedMenuIds },
                    date: today
                },
                select: {
                    menuId: true,
                    remaining: true,
                }
            })

            const remainingMap: Record<string, number> = {};

            for (const inv of inventories) {
                remainingMap[inv.menuId] = inv.remaining
            }

            return remainingMap
        })()

        this.pendingQuotaRequests.set(requestKey, requestPromise)

        try {
            return await requestPromise
        } finally {
            this.pendingQuotaRequests.delete(requestKey)
        }
    }
}