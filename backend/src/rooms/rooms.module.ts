import { Module } from '@nestjs/common';
import { AmenitiesController, RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [RoomsController, AmenitiesController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
