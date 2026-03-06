import { Inject, Injectable, forwardRef } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MenuService } from "src/menu/menu.service";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class InventoryService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => MenuService))
        private readonly menuService: MenuService,
    ) { }

    async deductInventoryTx(
        tx: Prisma.TransactionClient,
        menuId: string,
        quantity: number,
        menuName: string,
    ): Promise<string | null> {

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const menu = await this.menuService.findMenu(menuId)

        await tx.inventory.upsert({
            where: {
                menuId_date: { menuId, date: today }
            },
            update: {},
            create: {
                menuId,
                date: today,
                dailyQuota: menu.maxDaily,
                remaining: menu.maxDaily
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
        })

        if (result.count === 0) {
            return menuName
        }

        return null
    }
}