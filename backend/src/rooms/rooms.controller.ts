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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AppException } from '../common/app-exception';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { imageUploadOptions, publicUploadPath } from '../common/utils/uploads';
import { AvailabilityQueryDto, CreateRoomDto, RoomsQueryDto, UpdateRoomDto } from './dto/rooms.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: RoomsQueryDto, @CurrentUser() user: AuthUser | null) {
    return this.rooms.list(query, user);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.rooms.get(id);
  }

  @Get(':id/availability')
  availability(@Param('id', ParseIntPipe) id: number, @Query() query: AvailabilityQueryDto) {
    return this.rooms.availability(id, query);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto) {
    return this.rooms.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.rooms.remove(id);
  }

  @Post(':id/photo')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions('rooms', 5 * 1024 * 1024)))
  uploadPhoto(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new AppException(400, 'FILE_REQUIRED', 'Файл не передан');
    return this.rooms.setPhoto(id, publicUploadPath('rooms', file.filename));
  }
}

@ApiTags('Rooms')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list() {
    return this.rooms.listAmenities();
  }
}
