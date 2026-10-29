import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SortablePaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateBookingDto {
  @Type(() => Number)
  @IsInt({ message: 'Укажите комнату' })
  roomId: number;

  @IsString({ message: 'Название встречи обязательно' })
  @MinLength(2, { message: 'Название должно быть не короче 2 символов' })
  @MaxLength(150, { message: 'Название должно быть не длиннее 150 символов' })
  title: string;

  @IsISO8601({}, { message: 'startsAt должен быть датой в формате ISO 8601' })
  startsAt: string;

  @IsISO8601({}, { message: 'endsAt должен быть датой в формате ISO 8601' })
  endsAt: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roomId?: number;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Название должно быть не короче 2 символов' })
  @MaxLength(150, { message: 'Название должно быть не длиннее 150 символов' })
  title?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'startsAt должен быть датой в формате ISO 8601' })
  startsAt?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endsAt должен быть датой в формате ISO 8601' })
  endsAt?: string;
}

export class MyBookingsQueryDto extends SortablePaginationQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export class BookingsQueryDto extends MyBookingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roomId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
