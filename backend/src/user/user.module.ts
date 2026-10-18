import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RestaurantModule } from 'src/restaurant/restaurant.module';

@Module({
  imports: [forwardRef(() => RestaurantModule)],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
