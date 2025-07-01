import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { PrismaService } from 'prisma/prisma.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { OrderModule } from 'src/order/order.module';
import { MenuModule } from 'src/menu/menu.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    OrderModule,
    UserModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/restaurants',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  ],
  controllers: [RestaurantController],
  providers: [RestaurantService, PrismaService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
