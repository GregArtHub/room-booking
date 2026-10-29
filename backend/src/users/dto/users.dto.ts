import { Locale, Theme } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SortablePaginationQueryDto, ToBoolean } from '../../common/dto/pagination.dto';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Имя должно быть не короче 2 символов' })
  @MaxLength(100, { message: 'Имя должно быть не длиннее 100 символов' })
  fullName?: string;

  @IsOptional()
  @IsEnum(Locale, { message: 'Язык должен быть ru или en' })
  locale?: Locale;

  @IsOptional()
  @IsEnum(Theme, { message: 'Тема должна быть light, dark или system' })
  theme?: Theme;
}

export class ChangePasswordDto {
  @IsString({ message: 'Текущий пароль обязателен' })
  currentPassword: string;

  @IsString({ message: 'Новый пароль обязателен' })
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(72, { message: 'Пароль должен быть не длиннее 72 символов' })
  newPassword: string;
}

export class UsersQueryDto extends SortablePaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['guest', 'employee', 'admin'])
  role?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  blocked?: boolean;
}

export class SetRoleDto {
  @IsIn(['employee', 'admin'], { message: 'Роль должна быть employee или admin' })
  role: string;
}

export class SetBlockedDto {
  @IsBoolean({ message: 'blocked должен быть true или false' })
  blocked: boolean;
}
