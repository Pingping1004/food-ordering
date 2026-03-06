import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { InventoryService } from "./inventory.service";
import { MenuModule } from "src/menu/menu.module";

@Module({
    imports: [
        PrismaModule,
        forwardRef(() => MenuModule),
    ],
    providers: [InventoryService],
    exports: [InventoryService],
})
export class InventoryModule {}