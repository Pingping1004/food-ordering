import { forwardRef, Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { OrderModule } from 'src/order/order.module';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    OrderModule,
    RestaurantModule,
    UploadModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/menus',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  ],
  controllers: [MenuController],
  providers: [MenuService, PrismaService],
  exports: [MenuService],
})
export class MenuModule { }
