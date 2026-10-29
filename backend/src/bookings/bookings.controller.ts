import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BookingsService } from './bookings.service';
import {
  BookingsQueryDto,
  CreateBookingDto,
  MyBookingsQueryDto,
  UpdateBookingDto,
} from './dto/bookings.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('my')
  my(@CurrentUser() user: AuthUser, @Query() query: MyBookingsQueryDto) {
    return this.bookings.listMy(user, query);
  }

  @Get()
  @Roles('admin')
  all(@Query() query: BookingsQueryDto) {
    return this.bookings.listAll(query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.bookings.cancel(user, id);
  }
}
