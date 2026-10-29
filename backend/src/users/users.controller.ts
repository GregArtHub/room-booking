import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { imageUploadOptions, publicUploadPath } from '../common/utils/uploads';
import {
  ChangePasswordDto,
  SetBlockedDto,
  SetRoleDto,
  UpdateProfileDto,
  UsersQueryDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions('avatars', 2 * 1024 * 1024)))
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new AppException(400, 'FILE_REQUIRED', 'Файл не передан');
    return this.users.setAvatar(user.id, publicUploadPath('avatars', file.filename));
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(user.id, dto);
  }

  @Get()
  @Roles('admin')
  list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }

  @Patch(':id/role')
  @Roles('admin')
  setRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRoleDto,
  ) {
    return this.users.setRole(actor.id, id, dto);
  }

  @Patch(':id/block')
  @Roles('admin')
  setBlocked(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetBlockedDto,
  ) {
    return this.users.setBlocked(actor.id, id, dto);
  }
}
